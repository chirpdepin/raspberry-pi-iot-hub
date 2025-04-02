# Matter Setup for Raspberry Pi IoT Hub

This guide explains how to install and configure Matter on your Raspberry Pi to connect and control Matter-compatible devices, with a focus on the Aqara Door/Window Sensor P2.

## What is Matter?

Matter is a new smart home connectivity standard that enables interoperability between different smart home ecosystems. It can run over Thread as a transport protocol, allowing devices from different manufacturers to communicate seamlessly.

## Prerequisites

You will need:

- A Raspberry Pi with Raspbian OS
- Internet connection for downloading dependencies
- A Matter-compatible device (e.g., Aqara Door/Window Sensor P2)
- An OpenThread Border Router (OTBR) already set up (see [README_OTBR.md](./README_OTBR.md))

## Installation

This guide is based on official documentation from:

- [Nordic Semiconductor Matter Building Guide](https://docs.nordicsemi.com/bundle/ncs-latest/page/matter/BUILDING.html)
- [Nordic Semiconductor CHIP Tool Guide](https://docs.nordicsemi.com/bundle/ncs-latest/page/matter/chip_tool_guide.html)

### Step 1: Install Dependencies

```bash
sudo apt-get install git gcc g++ pkg-config libssl-dev libdbus-1-dev \
     libglib2.0-dev libavahi-client-dev ninja-build python3-venv python3-dev \
     python3-pip unzip libgirepository1.0-dev libcairo2-dev libreadline-dev \
     default-jre
```

### Step 2: Clone the CHIP Repository

```bash
cd ~
git clone --depth=1 https://github.com/project-chip/connectedhomeip.git
cd ~/connectedhomeip
./scripts/checkout_submodules.py --shallow --recursive --platform linux
```

### Step 3: Build the Matter Controller

```bash
cd ~/connectedhomeip
source scripts/activate.sh
./scripts/examples/gn_build_example.sh examples/chip-tool ~/chip-tool
```

## Using Matter with Devices

### Commissioning Aqara Door/Window Sensor P2

To commission the Aqara Door/Window Sensor P2 with Matter over Thread:

```bash
~/chip-tool/chip-tool pairing code-thread 110 hex:0e08000000000001000035060004001fffe00708fd4b02bc88d6c9050c0402a0f7f8051000112233445566778899aabbccddeeff030e4f70656e54687265616444656d6f0410445f2b5ca6f2a93a55ce570a70efeecb000300000f0208111111112222222201021234 16258442499 --paa-trust-store-path /home/iotmaster/connectedhomeip/credentials/production/paa-root-certs --bypass-attestation-verifier true
```

Where:
- `110` - Node ID (you can choose any number)
- `16258442499` - Matter pairing code found on the sensor
- The long hex string - Thread network credentials, obtained by running `ot-ctl dataset active -x`

### General Commissioning Commands

For other Matter devices, you can use these general commands:

#### Basic Pairing with Setup Code

```bash
~/chip-tool/chip-tool pairing code <node-id> <setup-code>
```

Replace `<node-id>` with a number (like 1) to identify the device in your Matter network, and `<setup-code>` with the setup code from your device.

#### BLE-WiFi Pairing

```bash
~/chip-tool/chip-tool pairing ble-wifi <node_id> <ssid> <password> <pin_code> <discriminator>
```

In this command, BLE is used for provisioning, and Wi-Fi is used for controlling the device.

#### BLE-Thread Pairing

```bash
~/chip-tool/chip-tool pairing ble-thread 0x00a30f1d10010001 hex:0e08000000000001000035060004001fffe00708fd4b02bc88d6c9050c0402a0f7f8051000112233445566778899aabbccddeeff030e4f70656e54687265616444656d6f0410445f2b5ca6f2a93a55ce570a70efeecb000300000f0208111111112222222201021234 08811712 3840
```

### Interacting with Aqara Door/Window Sensor P2

#### Read Current State

```bash
~/chip-tool/chip-tool booleanstate read state-value 110 1
```

#### Subscribe to State Changes

```bash
~/chip-tool/chip-tool booleanstate subscribe state-value 1 65535 110 1
```

### Reading Basic Device Information

```bash
# Read vendor name
~/chip-tool/chip-tool basicinformation read vendor-name 110 0

# Read product name
~/chip-tool/chip-tool basicinformation read product-name 110 0

# Read model number
~/chip-tool/chip-tool basicinformation read model-number 110 0

# Read hardware version
~/chip-tool/chip-tool basicinformation read hardware-version 110 0

# Read software version
~/chip-tool/chip-tool basicinformation read software-version 110 0
```

## Integration with Chirp Service

*Coming soon: Information about connecting Matter devices to the Chirp bridge for enhanced functionality.*