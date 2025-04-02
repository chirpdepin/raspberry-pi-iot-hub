# Zigbee2MQTT Setup for Raspberry Pi IoT Hub

This guide explains how to install and configure Zigbee2MQTT on your Raspberry Pi and connect it to the Chirp Service for smart home automation.

## What is Zigbee2MQTT?

Zigbee2MQTT is a bridge that allows you to connect Zigbee devices to your MQTT broker, making it possible to integrate various Zigbee smart home devices with your IoT Hub.

## Installation

Follow the official Zigbee2MQTT installation documentation: [Official Zigbee2MQTT Installation Guide](https://www.zigbee2mqtt.io/guide/installation/01_linux.html#optional-running-as-a-daemon-with-systemctl)

As shown in the official documentation, you'll need to create two important files:

- `/opt/zigbee2mqtt/data/configuration.yaml` - Configuration file
- `/etc/systemd/system/zigbee2mqtt.service` - Service file (if you want to run as a service)

## Running as a Service

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

*Coming soon: Information about connecting Zigbee2MQTT to the Chirp bridge for enhanced functionality.*
