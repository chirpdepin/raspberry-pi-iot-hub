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
1. Create configuration directory:
```bash
sudo mkdir -p /home/iotmaster/basicstation-docker
cd /home/iotmaster/basicstation-docker
```

2. Create docker-compose.yml:
```bash
sudo nano docker-compose.yml
```

Add the following content:
```yaml
version: '2.0'
services:
  basicstation:
    image: xoseperez/basicstation:latest
    restart: unless-stopped
    devices:
      - "/dev/spidev0.0:/dev/spidev0.0"
    environment:
      - STATION_DEVICEID=RAK5146
      - STATION_RADIOCFG=sx1303_2g4
      - STATION_HWSPEC=sx1303
      - STATION_TCPORT1=443
      - STATION_TCURL1=wss://lora-eu868.cloud.chirpwireless.io:443
      - STATION_RADIOINIT=/usr/local/rak/lora/rak5146/reset_lgw.sh start
      - RESET_GPIO=17
```

### 4. Install Web Interface
1. Create directory structure:
```bash
mkdir -p /home/iotmaster/hubconfig/static
cd /home/iotmaster/hubconfig
```

2. Install Go:
```bash
sudo apt-get install golang
```

3. Transfer web interface files (using WinSCP or SCP):
   - Copy files from provided package to `/home/iotmaster/hubconfig/`

4. Build and run the interface:
```bash
cd /home/iotmaster/hubconfig
go build
sudo ./hubconfig
```

## Gateway Registration

1. Access web interface at `http://<raspberry-pi-ip>`
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
   - Check if service is running: `ps aux | grep hubconfig`
   - Verify port 80 is available: `sudo netstat -tulpn | grep 80`

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
