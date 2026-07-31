# Zigbee2MQTT Setup for Raspberry Pi IoT Hub

> **On the Ubuntu build none of the manual steps below are needed.** Zigbee2MQTT, Mosquitto and dongle
> support are installed by `scripts/install-radios.sh` — see **[docs/zigbee-thread.md](docs/zigbee-thread.md)**.
> The guide below describes the older Raspberry Pi OS image and carries three errors worth knowing about:
>
> - **Do not use `/dev/ttyACM0`.** It is assigned in enumeration order and will point at a different
>   device after a reboot, a replug, or once a second dongle is present. Use the stable role symlink
>   **`/dev/zigbee`**.
> - **This document and [README_OTBR.md](README_OTBR.md) both claim the same nRF52840 dongle on the same
>   port.** That cannot work: Zigbee needs EmberZNet/zStack/ZBOSS firmware, Thread needs OpenThread RCP
>   firmware, and one radio runs one firmware at a time. Running both means **two dongles**.
> - **`adapter: zboss` is specific to an nRF52840 running ZBOSS NCP.** For the common coordinators —
>   SONOFF Dongle Plus MG24, ZBDongle-E/P, SLZB-06/07, SkyConnect — the correct value is `ember` or
>   `zstack`. `detect-radios.sh` reports it as `ZIGBEE_ADAPTER`; the wrong value is the most common cause
>   of "Failed to connect to the adapter".
>
> Also note the Mosquitto snippet below appends `allow_anonymous true` with a literal `\n`, which
> Mosquitto rejects, and would expose control of every Zigbee device to the whole network. The Ubuntu
> build binds the broker to loopback instead.

This guide explains how to install and configure Zigbee2MQTT on your Raspberry Pi and connect it to the Chirp Service for smart home automation.

## What is Zigbee2MQTT?

Zigbee2MQTT is a bridge that allows you to connect Zigbee devices to your MQTT broker, making it possible to integrate various Zigbee smart home devices with your IoT Hub.

## Installation

## MQTT Configuration

Zigbee2MQTT requires an MQTT broker. Make sure Mosquitto is installed and configured:

```bash
# Install Mosquitto MQTT broker
sudo apt-get install -y mosquitto mosquitto-clients

# Enable and start Mosquitto
sudo systemctl enable mosquitto
sudo systemctl start mosquitto
```

## Installation Zigbee2MQTT

Follow the official Zigbee2MQTT installation documentation: [Official Zigbee2MQTT Installation Guide](https://www.zigbee2mqtt.io/guide/installation/01_linux.html#optional-running-as-a-daemon-with-systemctl)

As shown in the official documentation, you'll need to create one important files:

- `/opt/zigbee2mqtt/data/configuration.yaml` - Configuration file

If you are using nrf52840 dongle and it is connected to `/dev/ttyACM0`, add the following to the configuration:

```ini
serial:
  port: /dev/ttyACM0
  adapter: zboss
```

## Running as a Service

If you want to run Zigbee2MQTT as a service, you need to create a file `/etc/systemd/system/zigbee2mqtt.service` - Service file

### Start Zigbee2MQTT Service

```bash
sudo systemctl enable zigbee2mqtt.service
sudo systemctl start zigbee2mqtt.service
```

### Stop Zigbee2MQTT Service

```bash
sudo systemctl stop zigbee2mqtt.service
sudo systemctl disable zigbee2mqtt.service
```

### Check Service Status

```bash
sudo systemctl status zigbee2mqtt.service
sudo journalctl -u zigbee2mqtt.service -f
```

### Manual Start

```bash
cd /opt/zigbee2mqtt/
pnpm start
```

### Access the Web Interface

To access the Zigbee2MQTT web interface, navigate to:

```bash
http://<raspberry-pi-ip>:8080
```

## Troubleshooting

### Service Restarts After 90 Seconds

If your service restarts approximately 90 seconds after starting, you may need to modify your service configuration file. Comment out certain lines as shown below in `/etc/systemd/system/zigbee2mqtt.service`:

```ini
[Unit]
Description=zigbee2mqtt
After=network.target

[Service]
Environment=NODE_ENV=production
# Type=notify
ExecStart=/usr/bin/node index.js
WorkingDirectory=/opt/zigbee2mqtt
StandardOutput=inherit
# Or use StandardOutput=null if you don't want Zigbee2MQTT messages filling syslog, for more options see systemd.exec(5)
StandardError=inherit
# WatchdogSec=10s
Restart=always
RestartSec=10s
User=iotmaster

[Install]
WantedBy=multi-user.target
```

For more information about this issue, see [GitHub Issue #22164](https://github.com/Koenkk/zigbee2mqtt/issues/22164).

### Troubleshooting MQTT Connection

If you see a "MQTT failed to connect" error, check:

1. That Mosquitto is running: `sudo systemctl status mosquitto`
2. Configure Mosquitto to allow anonymous connections (for testing):

   ```bash
   echo "allow_anonymous true\nlistener 1883" | sudo tee -a /etc/mosquitto/mosquitto.conf
   sudo systemctl restart mosquitto
   ```

3. Test MQTT connectivity:

   ```bash
   # In one terminal
   mosquitto_sub -h localhost -t "test" -v
   
   # In another terminal
   mosquitto_pub -h localhost -t "test" -m "hello"
   ```

## MQTT Commands

### Check Zigbee2MQTT Status via MQTT

```bash
# Check bridge state
mosquitto_sub -h <raspberry-pi-ip> -t "zigbee2mqtt/bridge/state" -v

# Monitor all Zigbee2MQTT topics
mosquitto_sub -h <raspberry-pi-ip> -t "zigbee2mqtt/#" -v

# Monitor a specific device (replace with your device ID)
mosquitto_sub -h <raspberry-pi-ip> -t "zigbee2mqtt/0x00158d00053c075f/#" -v
```

### Control Zigbee Devices via MQTT

Example commands for controlling a light bulb:

```bash
# Turn off the light
mosquitto_pub -h <raspberry-pi-ip> -t "zigbee2mqtt/0x00158d00053c075f/set" -m '{"state": "OFF"}'

# Turn on the light
mosquitto_pub -h <raspberry-pi-ip> -t "zigbee2mqtt/0x00158d00053c075f/set" -m '{"state": "ON"}'

# Set color temperature
mosquitto_pub -h <raspberry-pi-ip> -t "zigbee2mqtt/0x00158d00053c075f/set" -m '{"color_temp": 250}'
```

## Integration with Chirp Service

To connect your Zigbee2MQTT installation to the Chirp cloud service, you can use the Chirp MQTT Bridge. This bridge forwards all messages between your local Zigbee2MQTT instance and the Chirp cloud, allowing you to control your Zigbee devices remotely.

For detailed installation and configuration instructions, please follow the guide in the [Chirp Bridge README](./chirp_bridge/README.md).
