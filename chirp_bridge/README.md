# Chirp MQTT Bridge

MQTT bridge for forwarding messages between local Zigbee2MQTT and cloud MQTT server.

## Description

This utility creates a bidirectional bridge between a local MQTT broker connected to Zigbee2MQTT and a cloud MQTT server. This allows:

- Forwarding all messages from local Zigbee2MQTT to the cloud
- Receiving commands from the cloud and sending them to local Zigbee2MQTT
- Providing secure connection to the cloud using TLS and authentication

## Requirements

- Go 1.16 or higher
- Local MQTT broker with running Zigbee2MQTT
- Access to a cloud MQTT server

## Installation

1. Copy the entire directory to your Raspberry Pi:

   ```bash
   # From your development machine, copy the entire directory
   scp -r chirp_bridge iotmaster@192.168.0.225:/home/iotmaster/chirp_bridge
   ```

   Replace `your-raspberry-pi-ip` with your device's actual IP address.

2. Compile the application:

   ```bash
   # Navigate to the project directory
   cd ~/chirp_bridge
   
   # Install dependencies
   go mod tidy
   
   # If you encounter network issues, try one of these alternatives:
   # GOPROXY=https://proxy.golang.org go mod tidy
   # or
   # GODEBUG=netdns=cgo go mod tidy
   
   # Compile the application
   go build -o chirp_bridge
   ```

## Configuration

Edit the `config.yaml` file according to your settings. There are two ways to configure the local MQTT connection:

### 1. Automatic Configuration

The bridge can automatically read settings from your Zigbee2MQTT configuration file:

```yaml
# MQTT Bridge Configuration
local_mqtt:
  # Set mode to "auto" to read settings from Zigbee2MQTT configuration
  mode: "auto"
  # Path to Zigbee2MQTT configuration file
  zigbee2mqtt_config_path: "/opt/zigbee2mqtt/data/configuration.yaml"
  # The following manual settings will be ignored in auto mode
  server: "localhost"
  port: 1883
  base_topic: "zigbee2mqtt"
  username: ""  # Local MQTT username
  password: ""  # Local MQTT password

cloud_mqtt:
  server: "example.cloud.com"  # Replace with your cloud MQTT server address
  port: 8883
  base_topic: "zigbee2mqtt"
  username: "cloud_user"  # Cloud MQTT username
```

When using automatic configuration, the bridge will read the following from your Zigbee2MQTT configuration file:

```yaml
# Example Zigbee2MQTT configuration format
version: 4
mqtt:
  base_topic: zigbee2mqtt
  server: mqtt://localhost:1883
```

### 2. Manual Configuration

If you prefer to set the parameters manually:

```yaml
# MQTT Bridge Configuration
local_mqtt:
  # Set mode to "manual" to use the settings specified below
  mode: "manual"
  # Path is ignored in manual mode
  zigbee2mqtt_config_path: "/opt/zigbee2mqtt/data/configuration.yaml"
  # Manual settings
  server: "localhost"
  port: 1883
  base_topic: "zigbee2mqtt"
  username: ""  # Local MQTT username
  password: ""  # Local MQTT password

cloud_mqtt:
  server: "example.cloud.com"  # Replace with your cloud MQTT server address
  port: 8883
  base_topic: "zigbee2mqtt"
  username: "cloud_user"  # Cloud MQTT username
  password: "cloud_password"  # Cloud MQTT password
  use_tls: true  # Use TLS for cloud connection
```

## Running

```bash
./chirp_bridge [path_to_config]
```

By default, the program looks for the `config.yaml` file in the current directory. You can specify a different path to the configuration file as a command line argument.

## Usage

After starting, the bridge automatically:

1. Connects to the local MQTT broker
2. Connects to the cloud MQTT server
3. Starts forwarding all messages between them

### Examples

When a local device sends a status update:

```bash
zigbee2mqtt/0x00158d00053c075f -> cloud_server/zigbee2mqtt/0x00158d00053c075f
```

When a command is sent from the cloud:

```bash
cloud_server/zigbee2mqtt/0x00158d00053c075f/set -> zigbee2mqtt/0x00158d00053c075f/set
```

## Running as a systemd service

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/chirp-bridge.service
```

File contents:

```ini
[Unit]
Description=Chirp MQTT Bridge
After=network.target mosquitto.service

[Service]
ExecStart=/home/iotmaster/chirp_bridge/chirp_bridge /home/iotmaster/chirp_bridge/config.yaml
WorkingDirectory=/home/iotmaster/chirp_bridge
Restart=always
RestartSec=10
User=iotmaster

[Install]
WantedBy=multi-user.target
```

Activate and start the service:

```bash
sudo systemctl enable chirp-bridge.service
sudo systemctl start chirp-bridge.service
```

## Logging

The program outputs logs to standard output. When running as a systemd service, logs can be viewed using:

```bash
sudo journalctl -u chirp-bridge.service -f
```
