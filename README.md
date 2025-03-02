# DIY Raspberry Pi LoRaWAN Gateway for Home Automation

Welcome to the Raspberry Pi IoT Hub repository! This project helps you build your own DIY LoRaWAN gateway using a Raspberry Pi and RAK5146 concentrator, allowing you to connect LoRaWAN devices to Chirp's network and the Home Senses platform for smart home automation.

## What is This Project?

This repository contains everything you need to transform a Raspberry Pi into a powerful LoRaWAN gateway that connects to Chirp's cloud services. With this setup, you can:

- Create your own LoRaWAN gateway for a fraction of the cost of commercial solutions
- Connect various LoRaWAN sensors and devices throughout your home
- Automate your home using the Home Senses platform
- Contribute to the growing community of DIY IoT enthusiasts

Whether you're a hobbyist, maker, or professional looking to explore LoRaWAN technology, this project provides a complete, open-source solution to get started.

## Repository Contents

- **Documentation**: Comprehensive guides for hardware setup, software installation, and troubleshooting
- **Configuration Files**: Templates and examples for Basic Station and system services
- **Web Interface**: A Go-based configuration utility to easily set up your gateway
- **Scripts**: Utility scripts for installation and maintenance

## Hardware Requirements

- Raspberry Pi 4 (4GB or 8GB RAM recommended)
- RAK5146 mPCIe card with SX1303 chipset
- RAK HAT using mPCIe interface
- 32GB or larger SD card
- 5V/3A USB-C power supply
- LoRa antenna (and optionally GPS antenna)

## Quick Start Guide

1. Assemble the hardware components (see [Hardware Setup](docs/hardware-setup.md))
2. Download the [pre-configured Raspberry Pi OS image](#download-image)
3. Flash the image to your SD card
4. Configure your gateway to connect to Chirp's network
5. Register your gateway on the Home Senses platform
6. Start connecting LoRaWAN devices to automate your home

## Pre-configured Image

For convenience, we provide a pre-configured Raspberry Pi OS image with all necessary software installed.

### Download Image

You can download the latest Raspberry Pi OS image with pre-configured IoT Hub software here:
- [Download Raspberry Pi IoT Hub Image]() (Coming soon)

### Image Contents

The pre-configured image contains:

#### Pre-installed Software
- Raspberry Pi OS (64-bit)
- Docker and Docker Compose
- Basic Station container (xoseperez/basicstation:latest)

#### Configuration
- SPI interface enabled for RAK5146
- Docker configured for auto-start
- Basic Station configured for Chirp's network

## Hardware Setup

### RAK HAT Configuration
The RAK HAT with mPCIe interface is configured for:
- SPI interface enabled
- Reset pin on GPIO 17
- Power management handled by HAT
- Automatic detection of RAK5146 module

### RAK5146 Features
- Concentrator: Semtech SX1303 chipset
- Design: CORECELL
- TX Power: Up to 27 dBm
- RX Channels: 8 multi-SF + 1 FSK
- GPS: Integrated for PPS synchronization

### Physical Connections
1. Insert the RAK5146 mPCIe card into the RAK HAT
2. Mount the RAK HAT on the Raspberry Pi 4's GPIO header
3. Connect the antenna to the SMA connector
4. (Optional) Connect the GPS antenna if using location services

## SPI Interface
The system is configured to use:
- SPI device: `/dev/spidev0.0`
- SPI speed: 8MHz
- Reset GPIO: 17
- Enable GPIO: 0

## Image Contents

### Pre-installed Software
- Raspberry Pi OS (64-bit)
- Docker and Docker Compose
- Basic Station container (xoseperez/basicstation:latest)

### Configuration
- SPI interface enabled for RAK5146
- Docker configured for auto-start
- Basic Station configured for:
  - SPI interface
  - Reset GPIO on pin 17
  - EU868 frequency plan
  - Connection to ChirpWireless.io LNS

## Quick Start

1. Flash the image to an SD card using Raspberry Pi Imager
2. Insert the SD card into your Raspberry Pi 4
3. Power on the device
4. The Basic Station will automatically start and try to connect to ChirpWireless.io

## Important Notes

### Certificate Configuration

The Basic Station requires three certificate files in specific formats:

#### Certificate Files
- `tc.trust`: Root CA certificate
- `tc.crt`: Client certificate
- `tc.key`: Private key

#### Certificate Format Requirements
1. **File Format**: PEM format (Base64 encoded DER certificate)
2. **Line Endings**: Unix style (LF, not CRLF)
3. **No Extra Spaces**: No trailing spaces or empty lines after the END certificate line
4. **Permissions**: Read-only (chmod 400)

Example of correct certificate format:
```
-----BEGIN CERTIFICATE-----
MIIBxTCCAWugAwIBAgIQd0cHKqXEsp1h/jxLUV+HZTAKBggqhkjOPQQDAjA4MRYw
... [certificate content] ...
KCAgELMJqJkwCgYIKoZIzj0EAwIDSAAwRQIhAK0jN5HPhvhk9DQzKX/st9kM8Hz5
-----END CERTIFICATE-----
```

#### Certificate Placement
Place the certificate files in `/home/iotmaster/basicstation-docker/`:
```bash
/home/iotmaster/basicstation-docker/
├── tc.trust
├── tc.crt
└── tc.key
```

### Gateway EUI Formation

The gateway EUI is a unique 64-bit identifier derived from the Raspberry Pi's ethernet MAC address:

1. **Format**: `E45F01FFFE{6_last_digits}`
2. **Derivation**:
   - Prefix: `E45F01` (Fixed Chirp prefix)
   - Middle: `FFFE` (Standard IEEE separator)
   - Suffix: Last 6 digits of the ethernet MAC address

Example:
- MAC address: `E4:5F:01:11:1F:32`
- Gateway EUI: `E45F01FFFE111F32`

To find your gateway's EUI:
```bash
# Method 1: From Docker logs
docker compose logs | grep "Station EUI"

# Method 2: From ethernet MAC
ip link show eth0 | grep ether
```

## ChirpWireless.io Integration

The Senses IoT Hub is pre-configured to connect with ChirpWireless.io, a powerful LoRaWAN Network Server:

### Connection Details
- Server URL: `wss://lora-eu868.cloud.chirpwireless.io:443`
- Region: EU868 (863.0MHz - 870.0MHz)
- Protocol: Basic Station with LNS

### Gateway Registration
1. Log into your ChirpWireless.io account
2. Navigate to Gateway Management
3. Add a new gateway using the EUI from your device
4. Download the required certificates:
   - Root CA certificate (tc.trust)
   - Gateway certificate (tc.crt)
   - Gateway private key (tc.key)
5. Replace the existing certificates in `/home/iotmaster/basicstation-docker/`

### Frequency Plan
The gateway is configured for the EU868 band with the following channels:
- 867.1 MHz
- 867.3 MHz
- 867.5 MHz
- 867.7 MHz
- 867.9 MHz
- 868.1 MHz
- 868.3 MHz
- 868.5 MHz

### Data Rates
- DR0: SF12/BW125
- DR1: SF11/BW125
- DR2: SF10/BW125
- DR3: SF9/BW125
- DR4: SF8/BW125
- DR5: SF7/BW125
- DR6: SF7/BW250
- DR7: FSK

## Customization

### Docker Compose Configuration
The Basic Station configuration is in `/home/iotmaster/basicstation-docker/docker-compose.yml`

Key settings:
- `MODEL: "RAK5146"` - Concentrator model
- `INTERFACE: "SPI"` - Interface type
- `DEVICE: "/dev/spidev0.0"` - SPI device
- `RESET_GPIO: "17"` - Reset pin
- `TC_URI: "wss://lora-eu868.cloud.chirpwireless.io:443"` - LNS server URL

## Default Credentials
- Username: `iotmaster`
- Password: `123qweASD`
- Hostname: `chirphub`

**Important**: For security reasons, please change the default password after first login using the `passwd` command.

## Support
For issues and questions, please open an issue in the GitHub repository.

## License
This image is provided as-is under the MIT license.

# Senses IoT Hub

A complete DIY LoRaWAN gateway solution designed for home automation enthusiasts. This project helps you set up your own LoRaWAN gateway using a Raspberry Pi 4 and RAK5146 concentrator, connecting to Chirp's LNS (Network Server).

## Overview

The Senses IoT Hub provides:
- Easy-to-use web interface for configuration
- Basic Station protocol support
- Integration with Chirp's LNS
- Secure certificate management
- Docker-based deployment

## Hardware Requirements

- Raspberry Pi 4
- RAK5146 mPCIe card with SX1303 chipset
- RAK HAT using mPCIe interface
- 32GB or larger SD card
- Appropriate LoRa antenna

## Quick Start

1. Flash the provided SD card image
2. Connect the hardware
3. Power on your Raspberry Pi
4. Access the web interface at `http://<raspberry-pi-ip>`
5. Configure your gateway using certificates from app.chirpwireless.io

## Documentation

Detailed documentation is available in the `docs` directory:
- [Hardware Setup Guide](docs/hardware-setup.md)
- [Software Installation Guide](docs/software-setup.md)
- [Configuration Guide](docs/configuration.md)
- [API Documentation](docs/api.md)
- [Troubleshooting Guide](docs/troubleshooting.md)

## Features

- **Web Interface**
  - Easy certificate upload
  - Gateway EUI display
  - LNS configuration
  - Automatic service management

- **Basic Station Integration**
  - SX1303 HAL support
  - EU868 frequency plan
  - Automatic reset handling
  - Docker-based deployment

- **Security**
  - Secure certificate handling
  - Proper file permissions
  - Protected private key storage

## Default Access

- Web Interface: `http://<raspberry-pi-ip>`
- SSH Access: 
  - Username: `iotmaster`
  - Password: `123qweASD`
  - Port: 22

**Important**: Change the default password after first login!

## Contributing

We welcome contributions! Please see our [Contributing Guide](docs/CONTRIBUTING.md) for details.

## Support

If you encounter any issues:
1. Check the [Troubleshooting Guide](docs/troubleshooting.md)
2. Search existing GitHub issues
3. Create a new issue with detailed information

## License

This project is licensed under the BSD 3-Clause License. See [LICENSE](LICENSE) for details.

## Acknowledgments

- RAK Wireless for hardware support
- Chirp for LNS services
- Xose Pérez for Basic Station Docker implementation
