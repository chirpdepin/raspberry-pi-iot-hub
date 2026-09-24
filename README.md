# Raspberry Pi IoT Hub — historical installation reference

**Do not start a new installation from this guide.** The pre-built operating-system image is no
longer available here, and this repository does not provide a verified complete replacement
installation procedure. There is no image to download or write to an SD card from these instructions.

This repository preserves the earlier Raspberry Pi gateway software and setup notes. The material
below explains that earlier setup; it is not a current supported installer or evidence that a new
installation will work. Before a new installation, obtain an exact supported release and matching,
verified instructions through the project's published release process.

## Repository Contents

- **Documentation**: Historical hardware, installation and troubleshooting notes
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

A pre-built image is not available from this repository. Do not download or flash an image
on the basis of these notes. A new installation needs an exact supported release and matching,
verified instructions. The sections below describe the earlier setup only.

## Pre-configured Image

> **The pre-built image is not currently available for download.** The bucket that hosted it has been
> removed and the previous download link is dead. The software setup guide also depends on a
> separately supplied image; it is not a verified replacement installation procedure. This section
> records the earlier image contents only.

### Image Contents

The pre-configured image contained:

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

A pre-built image is not available from this repository. Do not download or flash an image
on the basis of these notes. A new installation needs an exact supported release and matching,
verified instructions. The sections below describe the earlier setup only.

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
|-- tc.trust
|-- tc.crt
`-- tc.key
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

This section describes the earlier Raspberry Pi 4 and RAK5146 gateway. Its installation image is
unavailable. Treat the features and configuration below as historical reference, not a current
complete installation offer.

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

A pre-built image is not available from this repository. Do not download or flash an image
on the basis of these notes. A new installation needs an exact supported release and matching,
verified instructions. The sections below describe the earlier setup only.

## Documentation

Detailed documentation is available in the `docs` directory:

- [Hardware Setup Guide](docs/hardware-setup.md)
- [Software Installation Guide](docs/software-setup.md)
- [Configuration Guide](docs/configuration.md)
- [API Documentation](docs/api.md)
- [Troubleshooting Guide](docs/troubleshooting.md)

Additional protocol-specific documentation:

- [Zigbee2MQTT Setup Guide](README_ZIGBEE.md) - Instructions for installing and configuring Zigbee2MQTT
- [OpenThread Border Router Setup Guide](README_OTBR.md) - Guide for setting up Thread network connectivity
- [Matter Protocol Setup Guide](README_MATTER.md) - Steps to configure Matter protocol for smart home devices

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
