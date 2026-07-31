# Contributing

Thanks for helping build the IoT Hub image. This project turns a Raspberry Pi into a LoRaWAN + Zigbee +
Thread hub that anyone can flash and connect to Chirp, so changes here land on other people's hardware —
that shapes most of the rules below.

Licensed under the [MIT License](../LICENSE). By contributing you agree your work is released under it.

## Before you start

Read **[CLAUDE.md](../CLAUDE.md)** first. It is the documentation map and it records the context that is
not derivable from the code — product intent, the platform traps that have already cost real time, and
which files belong to which of the two target OSes. **[IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md)**
tells you what is already built and verified.

## The rules that are not negotiable

These come from the product, not from taste. A change that breaks one of them will be sent back.

1. **Never bake in a region.** The image must serve EU868, US915, AS923 and the rest unchanged. Basic
   Station receives its channel plan from the LNS; Zigbee channel selection belongs in the rendered
   config, not in the image. We do not know where an adopter lives.
2. **Ship unprovisioned.** A freshly flashed card has no credentials and possibly no radio attached.
   Services must be gated (`ConditionPathExists=`) so they sit inactive rather than crash-looping.
   Nothing on the image may require a human to log in over SSH to become functional.
3. **Never use `/dev/ttyUSB*`, `/dev/ttyACM*` or `/dev/gpiochip0` directly.** Those are assigned in
   enumeration order and shift between boots, kernels and USB ports. Use the stable role symlinks
   (`/dev/zigbee`, `/dev/thread`) and resolve GPIO controllers at runtime.
4. **Pin every container image.** Never `latest`. Two units built a month apart must not behave
   differently with no way to tell from the device. Where upstream publishes only `latest`, pin by
   digest.
5. **Do not expose services to the LAN by default.** The broker and the Zigbee frontend bind loopback.
   An anonymous broker on `0.0.0.0` hands control of every Zigbee device in someone's home to their
   whole network.
6. **Scripts must be idempotent.** Adopters re-run installers; so do we, constantly. Never clobber an
   existing config file that an operator may have edited.
7. **Update [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) as work lands**, not in a batch at
   the end. Mark an item done only once it is **verified on real hardware**. When something is blocked,
   name the blocker, the owner and the next concrete action.
8. **Add any new document to the Documentation map in [CLAUDE.md](../CLAUDE.md)**, and structural
   changes to [REPOSITORY_STRUCTURE.md](../REPOSITORY_STRUCTURE.md). A document nobody can find still
   has to be maintained.

## Testing

**Changes to the radio, GPIO or service layers must be tested on real hardware.** This repo is full of
cases where the documented behaviour and the actual behaviour differ — a removed kernel ABI, a missing
temperature sensor, a config parser that rejects comments. Reasoning from upstream docs is not enough.

```bash
sudo ./scripts/install-ubuntu.sh        # LoRaWAN + everything below
sudo ./scripts/install-radios.sh        # Zigbee/Thread only
```

Minimum bar for a change that touches hardware:

- the relevant installer runs clean **from a wiped state**, not just incrementally;
- the device survives a **reboot** with no manual steps;
- for USB radios, an **unplug/replug** leaves the role symlink pointing at the right device.

Verification recipes are in [docs/ubuntu-2604.md](ubuntu-2604.md) and
[docs/zigbee-thread.md](zigbee-thread.md).

Hardware used for the reference build: Raspberry Pi 4B, RAK5146 SPI on a RAK2287/5146 Pi HAT, SONOFF
Dongle Plus MG24. Other supported coordinators are listed in
[docs/zigbee-thread.md](zigbee-thread.md#supported-coordinators) — if you test on one not in that table,
please add it.

## Style

- **US English** in code, comments, docs and commit messages.
- Shell: `bash` with `set -euo pipefail`, absolute paths in anything udev or systemd invokes.
- Comment the **why**, not the what. The valuable comments in this repo explain why an obvious approach
  was rejected — that is what stops the next person reintroducing it.
- Remove the dead code a rewrite leaves behind. Trace consumers first; do not judge from "looks unused".

## Pull requests

- Branch off the default branch with a descriptive name. One task, one branch, one PR.
- Say **what you tested on which hardware**. "Built successfully" is not a test for this project.
- Keep the diff to one concern. Reviewers read a change as a single diff.
- No tool-generated attribution footers in commits or PR bodies.

## Reporting a problem

Include: the board and OS (`uname -a`, `/etc/os-release`), the exact hardware, and the output of
`detect-radios.sh` and/or `detect-concentrator.sh`. For a radio that is misbehaving, `lsusb`,
`udevadm info -q property -n /dev/zigbee` and the service logs
(`journalctl -u iot-hub-zigbee`, `docker logs zigbee2mqtt`) are what make an issue actionable.

**Do not paste credentials.** LNS certificates, MQTT passwords, Wi-Fi PSKs and Zigbee network keys all
end up in these files and logs.
