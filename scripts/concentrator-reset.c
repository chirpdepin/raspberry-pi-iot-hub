/*
 * concentrator-reset — reset an SX1302/SX1303 (CORECELL) LoRa concentrator.
 *
 * Replaces the sysfs-based reset_lgw.sh shipped by Semtech and RAK. The sysfs
 * GPIO ABI (/sys/class/gpio) no longer exists on Ubuntu 26.04 / kernel 7.x, so
 * those scripts fail with "Directory nonexistent" and the concentrator never
 * answers on SPI.
 *
 * This uses the GPIO character device v2 ioctl ABI directly and links against
 * nothing but libc, so the same binary can be bind-mounted into the Basic
 * Station container, whose base image carries no GPIO tooling.
 *
 * Why not gpioset(1): libgpiod v2 holds the line and does not exit by default,
 * and releases the line when it does exit, leaving the final level undefined.
 * A pulse assembled from separate invocations is racy. One process must hold
 * the line request across the whole sequence.
 *
 * Build:  cc -O2 -Wall -Wextra -o concentrator-reset concentrator-reset.c
 * Usage:  concentrator-reset {start|stop|info}
 */

#define _GNU_SOURCE

#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#include <sys/ioctl.h>
#include <sys/stat.h>

#include <linux/gpio.h>

#define CONFIG_PATH "/etc/iot-hub/concentrator.conf"
#define CONSUMER "concentrator-reset"
#define PIN_UNSET (-1)
#define MAX_CHIP_INDEX 16

/*
 * Defaults are for the RAK2287/RAK5146 Pi HAT, which wires only the SX1302
 * reset line. The Semtech CORECELL reference design additionally uses
 * power-enable 18, SX1261 reset 22 and AD5338R reset 13; set those in
 * CONFIG_PATH when running on such a board.
 */
static int reset_pin = 17;
static int power_en_pin = PIN_UNSET;
static int sx1261_reset_pin = PIN_UNSET;
static int ad5338r_reset_pin = PIN_UNSET;
static long pulse_ms = 100;
static char chip_path[PATH_MAX];

static void wait_pulse(void)
{
	struct timespec ts;

	ts.tv_sec = pulse_ms / 1000;
	ts.tv_nsec = (pulse_ms % 1000) * 1000000L;
	nanosleep(&ts, NULL);
}

static char *trim(char *s)
{
	char *end;

	while (*s == ' ' || *s == '\t')
		s++;
	end = s + strlen(s);
	while (end > s && (end[-1] == ' ' || end[-1] == '\t' || end[-1] == '\n' ||
			   end[-1] == '\r' || end[-1] == '"' || end[-1] == '\''))
		*--end = '\0';
	while (*s == '"' || *s == '\'')
		s++;
	return s;
}

static int parse_pin(const char *value, int *out)
{
	char *endp;
	long v;

	if (*value == '\0' || strcasecmp(value, "none") == 0 ||
	    strcasecmp(value, "unset") == 0) {
		*out = PIN_UNSET;
		return 0;
	}

	errno = 0;
	v = strtol(value, &endp, 10);
	if (errno != 0 || *endp != '\0' || v < 0 || v > GPIO_V2_LINES_MAX) {
		fprintf(stderr, "concentrator-reset: invalid pin value '%s'\n", value);
		return -1;
	}

	*out = (int)v;
	return 0;
}

static int load_config(void)
{
	char line[512];
	FILE *f;

	f = fopen(CONFIG_PATH, "r");
	if (!f) {
		if (errno == ENOENT)
			return 0; /* defaults are fine */
		fprintf(stderr, "concentrator-reset: %s: %s\n", CONFIG_PATH, strerror(errno));
		return -1;
	}

	while (fgets(line, sizeof(line), f)) {
		char *key, *value, *eq;

		key = trim(line);
		if (*key == '#' || *key == '\0')
			continue;

		eq = strchr(key, '=');
		if (!eq)
			continue;
		*eq = '\0';
		value = trim(eq + 1);
		key = trim(key);

		if (strcmp(key, "GPIO_CHIP") == 0) {
			snprintf(chip_path, sizeof(chip_path), "%s", value);
		} else if (strcmp(key, "PULSE_MS") == 0) {
			pulse_ms = strtol(value, NULL, 10);
			if (pulse_ms < 1 || pulse_ms > 5000)
				pulse_ms = 100;
		} else if (strcmp(key, "RESET_PIN") == 0) {
			if (parse_pin(value, &reset_pin) < 0)
				goto fail;
		} else if (strcmp(key, "POWER_EN_PIN") == 0) {
			if (parse_pin(value, &power_en_pin) < 0)
				goto fail;
		} else if (strcmp(key, "SX1261_RESET_PIN") == 0) {
			if (parse_pin(value, &sx1261_reset_pin) < 0)
				goto fail;
		} else if (strcmp(key, "AD5338R_RESET_PIN") == 0) {
			if (parse_pin(value, &ad5338r_reset_pin) < 0)
				goto fail;
		}
	}

	fclose(f);
	return 0;

fail:
	fclose(f);
	return -1;
}

/*
 * Resolve the SoC GPIO controller at runtime rather than hardcoding
 * /dev/gpiochip0. The index is not stable: on a Pi 4 the SoC controller is
 * gpiochip0 and gpiochip1 is the firmware expander, but a Pi 5 exposes it as
 * gpiochip4, and kernel updates have renumbered it before.
 *
 * A candidate must have a device-tree node named "gpio@..." (the firmware
 * expander's node is plain "gpio", so it is excluded) and enough lines to
 * cover the configured pins.
 */
static int chip_matches(int index, unsigned int needed_lines)
{
	char link[PATH_MAX], sysfs[PATH_MAX], dev[PATH_MAX];
	struct gpiochip_info info;
	const char *node;
	ssize_t n;
	int fd, ok;

	snprintf(sysfs, sizeof(sysfs), "/sys/bus/gpio/devices/gpiochip%d/of_node", index);
	n = readlink(sysfs, link, sizeof(link) - 1);
	if (n < 0)
		return 0;
	link[n] = '\0';

	node = strrchr(link, '/');
	node = node ? node + 1 : link;
	if (strncmp(node, "gpio@", 5) != 0)
		return 0;

	snprintf(dev, sizeof(dev), "/dev/gpiochip%d", index);
	fd = open(dev, O_RDWR | O_CLOEXEC);
	if (fd < 0)
		return 0;

	memset(&info, 0, sizeof(info));
	ok = ioctl(fd, GPIO_GET_CHIPINFO_IOCTL, &info) >= 0 && info.lines > needed_lines;
	close(fd);

	return ok;
}

static int resolve_chip(unsigned int needed_lines)
{
	int i;

	if (chip_path[0] != '\0')
		return 0;

	for (i = 0; i < MAX_CHIP_INDEX; i++) {
		if (chip_matches(i, needed_lines)) {
			snprintf(chip_path, sizeof(chip_path), "/dev/gpiochip%d", i);
			return 0;
		}
	}

	fprintf(stderr,
		"concentrator-reset: no SoC GPIO controller found; "
		"set GPIO_CHIP in %s\n",
		CONFIG_PATH);
	return -1;
}

struct lines {
	unsigned int offsets[GPIO_V2_LINES_MAX];
	unsigned int count;
	int reset_idx;
	int power_en_idx;
	int sx1261_idx;
	int ad5338r_idx;
	unsigned int max_pin;
};

static int add_line(struct lines *l, int pin)
{
	if (pin == PIN_UNSET)
		return -1;

	l->offsets[l->count] = (unsigned int)pin;
	if ((unsigned int)pin > l->max_pin)
		l->max_pin = (unsigned int)pin;

	return (int)l->count++;
}

static void collect_lines(struct lines *l)
{
	memset(l, 0, sizeof(*l));
	l->reset_idx = add_line(l, reset_pin);
	l->power_en_idx = add_line(l, power_en_pin);
	l->sx1261_idx = add_line(l, sx1261_reset_pin);
	l->ad5338r_idx = add_line(l, ad5338r_reset_pin);
}

/* Drive one held line without disturbing the others. */
static int set_line(int req_fd, int idx, int value)
{
	struct gpio_v2_line_values vals;

	if (idx < 0)
		return 0;

	memset(&vals, 0, sizeof(vals));
	vals.mask = 1ULL << idx;
	vals.bits = value ? (1ULL << idx) : 0;

	if (ioctl(req_fd, GPIO_V2_LINE_SET_VALUES_IOCTL, &vals) < 0) {
		fprintf(stderr, "concentrator-reset: set line: %s\n", strerror(errno));
		return -1;
	}

	return 0;
}

static int request_lines(const struct lines *l)
{
	struct gpio_v2_line_request req;
	int fd;

	fd = open(chip_path, O_RDWR | O_CLOEXEC);
	if (fd < 0) {
		fprintf(stderr, "concentrator-reset: %s: %s\n", chip_path, strerror(errno));
		return -1;
	}

	memset(&req, 0, sizeof(req));
	memcpy(req.offsets, l->offsets, l->count * sizeof(req.offsets[0]));
	req.num_lines = l->count;
	req.config.flags = GPIO_V2_LINE_FLAG_OUTPUT;
	snprintf(req.consumer, sizeof(req.consumer), "%s", CONSUMER);

	if (ioctl(fd, GPIO_V2_GET_LINE_IOCTL, &req) < 0) {
		fprintf(stderr, "concentrator-reset: request lines on %s: %s\n",
			chip_path, strerror(errno));
		close(fd);
		return -1;
	}

	close(fd);
	return req.fd;
}

/*
 * CORECELL reset sequence, matching RAK's reset_lgw.sh: assert power enable,
 * then pulse the SX1302 reset high and back low, then release the optional
 * SX1261 and AD5338R resets. The line request stays open for the whole
 * sequence so no intermediate level can be lost.
 */
static int do_reset(void)
{
	struct lines l;
	int req_fd, rc = -1;

	collect_lines(&l);
	if (l.count == 0) {
		fprintf(stderr, "concentrator-reset: no pins configured\n");
		return -1;
	}

	if (resolve_chip(l.max_pin) < 0)
		return -1;

	req_fd = request_lines(&l);
	if (req_fd < 0)
		return -1;

	if (set_line(req_fd, l.power_en_idx, 1) < 0)
		goto out;
	if (l.power_en_idx >= 0)
		wait_pulse();

	if (set_line(req_fd, l.reset_idx, 0) < 0)
		goto out;
	wait_pulse();
	if (set_line(req_fd, l.reset_idx, 1) < 0)
		goto out;
	wait_pulse();
	if (set_line(req_fd, l.reset_idx, 0) < 0)
		goto out;
	wait_pulse();

	if (l.sx1261_idx >= 0) {
		if (set_line(req_fd, l.sx1261_idx, 0) < 0)
			goto out;
		wait_pulse();
		if (set_line(req_fd, l.sx1261_idx, 1) < 0)
			goto out;
		wait_pulse();
	}

	if (l.ad5338r_idx >= 0) {
		if (set_line(req_fd, l.ad5338r_idx, 0) < 0)
			goto out;
		wait_pulse();
		if (set_line(req_fd, l.ad5338r_idx, 1) < 0)
			goto out;
		wait_pulse();
	}

	rc = 0;

out:
	close(req_fd);
	return rc;
}

static int do_info(void)
{
	struct lines l;

	collect_lines(&l);
	if (resolve_chip(l.max_pin) < 0)
		return -1;

	printf("chip=%s\n", chip_path);
	printf("reset_pin=%d\n", reset_pin);
	printf("power_en_pin=%d\n", power_en_pin);
	printf("sx1261_reset_pin=%d\n", sx1261_reset_pin);
	printf("ad5338r_reset_pin=%d\n", ad5338r_reset_pin);
	printf("pulse_ms=%ld\n", pulse_ms);

	return 0;
}

int main(int argc, char **argv)
{
	const char *action;

	if (argc != 2) {
		fprintf(stderr, "Usage: %s {start|stop|info}\n", argv[0]);
		return 2;
	}

	if (load_config() < 0)
		return 1;

	action = argv[1];

	/*
	 * start and stop run the same sequence: the concentrator must be left
	 * held in a known state either way. Basic Station calls this via
	 * STATION_RADIOINIT before every radio (re)initialisation.
	 */
	if (strcmp(action, "start") == 0 || strcmp(action, "stop") == 0)
		return do_reset() == 0 ? 0 : 1;

	if (strcmp(action, "info") == 0)
		return do_info() == 0 ? 0 : 1;

	fprintf(stderr, "Usage: %s {start|stop|info}\n", argv[0]);
	return 2;
}
