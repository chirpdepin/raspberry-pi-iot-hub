# Software Setup Guide

This guide walks you through setting up your Senses IoT Hub software. The process involves preparing the SD card, installing necessary software, and configuring the Basic Station service.

## Prerequisites

- Hardware assembled according to [Hardware Setup Guide](hardware-setup.md)
- SD card (32GB or larger)
- Windows PC for initial setup
- Network connection for the Raspberry Pi

## Initial Setup

### 1. Prepare SD Card

1. Download the official RAK OS image (provided separately)
2. Flash the image using Raspberry Pi Imager:
   - Select custom image
   - Choose the downloaded RAK OS image
   - Select your SD card
   - Write the image

### 2. First Boot

1. Insert the SD card into Raspberry Pi
2. Connect ethernet cable
3. Connect power supply
4. Wait for initial boot (2-3 minutes)

### 3. Find Your Gateway

1. Use a network scanner or your router's interface to find the IP address
2. Default hostname is `chirphub`
3. Alternative: connect a monitor and keyboard to check IP address

## Remote Access Setup

### SSH Access

```bash
# From Windows PowerShell or Command Prompt
ssh iotmaster@<raspberry-pi-ip>
# Default password: 123qweASD
```

⚠️ **IMPORTANT**: Change the default password immediately:

```bash
passwd
```

### File Transfer Options

#### Using WinSCP (Recommended for Windows Users)

1. Download and install WinSCP
2. Connect using:
   - Host: `<raspberry-pi-ip>`
   - Username: `iotmaster`
   - Password: `123qweASD`
   - Port: 22

#### Using SCP Command Line

```bash
# Copy files to Raspberry Pi
scp <local-file> iotmaster@<raspberry-pi-ip>:/home/iotmaster/
```

## Software Configuration

### 1. Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Install Dependencies

```bash
# Install Docker if not already installed
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker iotmaster
```

### 3. Configure Basic Station

#### 3.1 Prepared configuration files

1. Copy basic station config files:

```bash
scp tc.trust tc.crt tc.key tc.uri iotmaster@<raspberry-pi-ip>:/home/iotmaster/config/
```

2. Add permissions config files:

```bash
chmod 400 /home/iotmaster/config/tc.*
chown iotmaster:iotmaster /home/iotmaster/config/tc.*
```

3. Create `basicstation-docker` directory:

```bash
mkdir -p /home/iotmaster/basicstation-docker
cd /home/iotmaster/basicstation-docker
```

4. Create `docker-compose.yml`:

```bash
nano /home/iotmaster/basicstation-docker/docker-compose.yml
```

Add the following content:

```yaml
version: '2.0'
services:
  basicstation:
    image: xoseperez/basicstation:latest
    container_name: basicstation
    # restart: unless-stopped
    privileged: true
    network_mode: host
    devices:
      - /dev/spidev0.0:/dev/spidev0.0
    volumes:
      - /home/iotmaster/config/tc.trust:/app/config/tc.trust
      - /home/iotmaster/config/tc.crt:/app/config/tc.crt
      - /home/iotmaster/config/tc.key:/app/config/tc.key
      - /home/iotmaster/config/tc.uri:/app/config/tc.uri
      - /sys:/sys
    environment:
      - MODEL=RAK5146
      - DESIGN=CORECELL
      - INTERFACE=SPI
      - DEVICE=/dev/spidev0.0
      - STATION_DEVICEID=RAK5146
      - STATION_RADIOCFG=sx1303_2g4
      - STATION_HWSPEC=sx1303
      - GATEWAY_EUI=E45F01FFFE111F64
      - TC_URI=/app/config/tc.uri
      - TC_TRUST=/app/config/tc.trust
      - TC_KEY=/app/config/tc.key
      - TC_CRT=/app/config/tc.crt
      - RESET_GPIO=529
```

#### 3.2 Start Basic Station

1. Start Basic Station:

```bash
cd /home/iotmaster/basicstation-docker/
docker-compose up -d
```

#### 3.3. Setting Up Basic Station as a System Service

To automatically start Basic Station when the system boots, we'll configure a systemd service:

1. Create a service file:

```bash
sudo nano /etc/systemd/system/basicstation.service
```

2. Add the following content:

```ini
[Unit]
Description=Basic Station LoRa Packet Forwarder
After=network.target docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=/home/iotmaster/basicstation-docker
ExecStartPre=-/usr/bin/docker-compose down
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
User=iotmaster
RemainAfterExit=yes
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
```

3. Save the file (Ctrl+O, then Enter) and exit the editor (Ctrl+X)

4. Reload the systemd configuration:

```bash
sudo systemctl daemon-reload
```

5. Enable the service to start automatically at boot:

```bash
sudo systemctl enable basicstation.service
```

6. Start the service:

```bash
sudo systemctl start basicstation.service
```

7. Check the service status:

```bash
sudo systemctl status basicstation.service
```

8. To view service logs:

```bash
sudo journalctl -u basicstation.service -f
```

Useful commands for service management:

- Stop: `sudo systemctl stop basicstation.service`
- Restart: `sudo systemctl restart basicstation.service`
- Disable autostart: `sudo systemctl disable basicstation.service`

### 4. Install Web Interface

1. Create directory structure:

```bash
mkdir -p /home/iotmaster/hubconfig
```

2. Install Go:

```bash
sudo apt install golang
```

3. Transfer web interface files (using WinSCP or SCP):
   - Copy hubconfig files using command: `scp -r hubconfig/* iotmaster@<raspberry-pi-ip>:/home/iotmaster/hubconfig/`
  

4. Build and run the interface:

```bash
cd /home/iotmaster/hubconfig
go build
# Запуск с правами root для доступа к порту 8000
sudo ./hubconfig
```

Веб-сервер запустится на порту 8000. Вы увидите сообщение: `Server starting on port :8000...`

5. Для автоматического запуска веб-интерфейса при загрузке системы, создайте сервис systemd:

```bash
sudo nano /etc/systemd/system/hubconfig.service
```

Добавьте следующее содержимое:

```ini
[Unit]
Description=IoT Hub Configuration Web Interface
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/iotmaster/hubconfig
ExecStart=/home/iotmaster/hubconfig/hubconfig
User=iotmaster
Group=iotmaster
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

6. Включите и запустите сервис:

```bash
sudo systemctl daemon-reload
sudo systemctl enable hubconfig.service
sudo systemctl start hubconfig.service
```

## Gateway Registration

1. Access web interface at `http://<raspberry-pi-ip>:8000`
2. Note your Gateway EUI (displayed on interface)
3. Register at [app.chirpwireless.io](https://app.chirpwireless.io):
   - Create account if needed
   - Add new gateway using your EUI
   - Download certificates

## Final Configuration

1. Through web interface:
   - Enter Chirp LNS URL
   - Upload certificates (tc.trust, tc.crt, tc.key)
   - Click "Configure Gateway"

2. Verify configuration:
   - Check Basic Station logs:

     ```bash
     docker logs -f basicstation-docker_basicstation_1
     ```

   - Look for successful connection messages

## Troubleshooting

### Common Issues

1. **Web Interface Not Accessible**
   - Check if service is running: `sudo systemctl status hubconfig.service`
   - Verify port 8000 is available: `sudo netstat -tulpn | grep 8000`
   - Проверьте логи: `sudo journalctl -u hubconfig.service -f`

2. **Basic Station Connection Fails**
   - Verify certificate formats
   - Check logs for specific errors
   - Ensure SPI is enabled

3. **Permission Issues**
   - Check file permissions: `ls -l /home/iotmaster/basicstation-docker/`
   - Verify docker group membership: `groups iotmaster`

## Next Steps

After successful setup:

1. Review [Configuration Guide](configuration.md) for advanced settings
2. Set up your first LoRaWAN device
3. Monitor gateway status on Chirp's platform

## Support

If you encounter issues:

1. Check detailed logs: `docker logs basicstation-docker_basicstation_1`
2. Review [Troubleshooting Guide](troubleshooting.md)
3. Create GitHub issue with logs and error messages
