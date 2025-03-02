# Hardware Setup Guide

This guide will walk you through setting up the hardware components of your Senses IoT Hub.

## Required Components

### Core Components
- Raspberry Pi 4 (4GB or 8GB RAM recommended)
- RAK2287/RAK5146 Pi HAT
- RAK5146 mPCIe module
- 32GB or larger SD card
- 5V/3A USB-C power supply for Raspberry Pi

### Antennas
- LoRa Antenna (iPEX connector)
- GPS Antenna (iPEX connector)

⚠️ **IMPORTANT**: Always connect antennas before powering on the gateway. Operating without antennas can damage the concentrator.

## Assembly Steps

### 1. Prepare the Raspberry Pi
- Ensure the Raspberry Pi is unplugged
- Remove any existing HATs or accessories
- Clean the GPIO pins if necessary

### 2. Mount the RAK2287/RAK5146 Pi HAT
1. Align the HAT with the Raspberry Pi's GPIO pins
2. Carefully press down until the HAT is fully seated
3. The HAT should sit parallel to the Raspberry Pi board

### 3. Install the RAK5146 mPCIe Module
1. Locate the mPCIe slot on the HAT
2. Align the RAK5146 module with the slot (45-degree angle)
3. Insert the module firmly
4. Lower the module to horizontal position
5. Secure with two mounting screws
   
### 4. Connect Antennas
1. Locate the two iPEX antenna ports on the RAK5146 module
2. Connect the LoRa antenna to the main RF port
3. Connect the GPS antenna to the GPS port
4. Ensure both connections are firm

## Antenna Placement

### LoRa Antenna
- Mount as high as possible
- Keep away from metal objects
- Maintain vertical orientation
- Use outdoor antenna for better range

### GPS Antenna
- Place with clear view of the sky
- Keep away from metal objects
- Horizontal orientation preferred
- Indoor placement is possible but may reduce accuracy

## Power Up Sequence

1. Double-check all connections
2. Ensure antennas are connected
3. Insert prepared SD card
4. Connect the power supply
5. Wait for boot sequence to complete

## Verification

Your hardware is properly set up when:
1. Raspberry Pi power LED is on
2. Raspberry Pi boots successfully
3. You can access the gateway via network

## Hardware Specifications

### RAK2287/RAK5146 Pi HAT
- Product Link: [RAK Documentation](https://docs.rakwireless.com/product-categories/wishat/rak2287-rak5146-pi-hat/overview/)
- Plug-and-play design
- No jumper configuration required
- mPCIe slot for RAK5146 module

### RAK5146 Module
- SX1303 chipset
- Dual iPEX antenna connectors
- Integrated GNSS support
- Secure mounting with screws

## Troubleshooting

### No Power
1. Check power supply connection
2. Verify power supply rating (5V/3A recommended)
3. Check for bent pins between Pi and HAT

### No Network Connection
1. Check Ethernet/WiFi connection
2. Verify Raspberry Pi boots properly
3. Check SD card is properly seated

### Poor LoRa Coverage
1. Verify antenna connection
2. Improve antenna placement
3. Consider outdoor antenna

## Safety Notes

1. **NEVER** power on without antennas connected
2. Handle boards by edges to avoid static damage
3. Use proper ESD protection when handling components
4. Ensure adequate ventilation for the gateway

## Next Steps

Once hardware setup is complete, proceed to:
1. [Software Installation Guide](software-setup.md)
2. [Configuration Guide](configuration.md)

## Support

If you encounter issues during hardware setup:
1. Check the [Troubleshooting Guide](troubleshooting.md)
2. Create a GitHub issue with:
   - Clear photos of your setup
   - Description of the problem
   - Steps you've tried
