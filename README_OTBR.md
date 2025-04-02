# OpenThread Border Router (OTBR) Setup for Raspberry Pi IoT Hub

This guide explains how to install and configure OpenThread Border Router on your Raspberry Pi to connect Thread devices to your network.

## What is OpenThread Border Router?

OpenThread Border Router (OTBR) is an open-source implementation of a Thread Border Router. It enables connectivity between Thread networks and other IP-based networks such as Wi-Fi or Ethernet.

## Prerequisites

You will need:

- A Raspberry Pi with Raspbian OS
- An nRF52840 Dongle to serve as a Radio Co-Processor (RCP)
- Internet connection for downloading dependencies

## Installation

This guide combines official documentation from:

- [OpenThread Border Router Codelab](https://openthread.io/codelabs/openthread-border-router#1)
- [Nordic Semiconductor Thread Tools](https://docs.nordicsemi.com/bundle/ncs-latest/page/nrf/protocols/thread/tools.html#configuring_a_radio_co-processor)

### Step 1: Prepare the Radio Co-Processor (RCP)

Build the radio firmware using official Nordic instructions or use our pre-built firmware (TODO: add our firmware link).

Flash the firmware using one of these methods:

```bash
# Option 1: Using nRF Programmer and a hex file
# (Follow Nordic documentation)

# Option 2: Using nrfutil
nrfutil dfu usb-serial -pkg ot_nrf52840_dongle_rcp.zip -p /dev/ttyACM0
```

### Step 2: Install OpenThread Border Router

```bash
# Navigate to home directory
cd /home/iotmaster

# Clone the repository
git clone https://github.com/openthread/ot-br-posix.git --depth 1

# Use specific commit from Nordic documentation
cd ot-br-posix
git pull --unshallow
git checkout fbde28a

# Build OTBR
./script/bootstrap
INFRA_IF_NAME=wlan0 ./script/setup

# Build OTBR with Web GUI support
WEB_GUI=1 ./script/bootstrap
INFRA_IF_NAME=wlan0 WEB_GUI=1 ./script/setup
```

### Step 3: Configure RCP Device

After building and installing OTBR, configure the RCP device's UART baud rate in otbr-agent. Modify the `/etc/default/otbr-agent` configuration file with the default RCP baud rate:

```bash
spinel+hdlc+uart:///dev/ttyACM0?uart-baudrate=1000000
```

## Running OTBR Services

### Start OTBR Services

```bash
# Start otbr-agent
sudo systemctl enable otbr-agent.service
sudo systemctl start otbr-agent.service

# Start otbr-web
sudo systemctl enable otbr-web.service
sudo systemctl start otbr-web.service
```

### Access the Web Interface

To access the OTBR web interface, navigate to:

```bash
http://<raspberry-pi-ip>:80
```

### Check Service Status

```bash
sudo service otbr-agent status
sudo service mdns status
sudo service otbr-web status
```

### Stop OTBR Services

```bash
# Stop otbr-agent
sudo systemctl stop otbr-agent.service
sudo systemctl disable otbr-agent.service

# Stop otbr-web
sudo systemctl stop otbr-web.service
sudo systemctl disable otbr-web.service
```

## Creating and Running a Thread Network

You can form a Thread network using either the web GUI or command line. For command line setup, follow these steps (see [OpenThread Border Router Codelab](https://openthread.io/codelabs/openthread-border-router#2) for more details)

### Form a Thread Network with OTBR

```bash
# Initialize a new dataset
sudo ot-ctl dataset init new
Done

# Commit the dataset to active
sudo ot-ctl dataset commit active
Done

# Enable the network interface
sudo ot-ctl ifconfig up
Done

# Start the Thread process
sudo ot-ctl thread start
Done
```

### Verify Thread Network Status

Wait a few seconds, then check that OTBR is acting as a Thread leader and there is an off-mesh-routable (OMR) prefix in the Thread Network Data:

```bash
# Check the current state
sudo ot-ctl state
leader
Done

# Show network data
sudo ot-ctl netdata show
Prefixes:
Prefixes:
fd76:a5d1:fcb0:1707::/64 paos med 4000
Routes:
fd49:7770:7fc5:0::/64 s med 4000
Services:
44970 5d c000 s 4000
44970 01 9a04b000000e10 s 4000
Done

# Show IP addresses
sudo ot-ctl ipaddr      
fda8:5ce9:df1e:6620:0:ff:fe00:fc11
fda8:5ce9:df1e:6620:0:0:0:fc38
fda8:5ce9:df1e:6620:0:ff:fe00:fc10
fd76:a5d1:fcb0:1707:f3c7:d88c:efd1:24a9
fda8:5ce9:df1e:6620:0:ff:fe00:fc00
fda8:5ce9:df1e:6620:0:ff:fe00:4000
fda8:5ce9:df1e:6620:3593:acfc:10db:1a8d
fe80:0:0:0:a6:301c:3e9f:2f5b
Done
```

## Integration with Chirp Service

*Coming soon: Information about connecting OpenThread Border Router to the Chirp bridge for enhanced functionality.*
