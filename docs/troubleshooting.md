# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with your Senses IoT Hub.

## Quick Diagnostics

First, check these common points:
1. Are all antennas properly connected?
2. Is the Basic Station service running?
3. Are certificates properly formatted?
4. Is the frequency plan correct for your region?

## Hardware Issues

### Gateway Not Powering Up
✓ **Check:**
- Power supply connection
- Power supply rating (5V/3A recommended)
- SD card properly inserted
- Power LED on Raspberry Pi

🔧 **Solution:**
1. Try a different power supply
2. Verify SD card is properly seated
3. Check for bent pins between Pi and HAT

### SPI Interface Not Found
✓ **Check:**
```bash
ls /dev/spidev*
```
Should show `/dev/spidev0.0`

🔧 **Solution:**
1. Enable SPI in raspi-config:
```bash
sudo raspi-config
# Navigate to Interface Options > SPI > Enable
```
2. Reboot the Raspberry Pi

### Concentrator Not Detected
⚠️ **Warning Signs:**
- "Failed to start concentrator" in logs
- No response from RAK5146

🔧 **Solution:**
1. Check physical connection:
   ```bash
   sudo i2cdetect -y 1
   ```
2. Verify module is properly seated
3. Check mounting screws
4. Try reseating the module

## Software Issues

### Basic Station Service Not Starting
✓ **Check Status:**
```bash
docker ps | grep basicstation
docker logs basicstation-docker_basicstation_1
```

🔧 **Solution:**
1. Restart the service:
   ```bash
   cd /home/iotmaster/basicstation-docker
   docker-compose down
   docker-compose up -d
   ```
2. Check logs for specific errors:
   ```bash
   docker logs -f basicstation-docker_basicstation_1
   ```

### Web Interface Not Accessible
✓ **Check:**
```bash
ps aux | grep hubconfig
netstat -tulpn | grep 80
```

🔧 **Solution:**
1. Restart the service:
   ```bash
   cd /home/iotmaster/hubconfig
   sudo killall hubconfig
   sudo ./hubconfig
   ```
2. Verify port 80 is available

### Certificate Issues

#### Invalid Certificate Format
⚠️ **Error Message:**
```
[any:ERRO] Parsing trust certificate: X509 - The CRT/CRL/CSR format is invalid
```

🔧 **Solution:**
1. Use web interface to upload certificates (recommended)
2. If manual, ensure:
   - No extra spaces
   - Unix line endings (LF)
   - No empty lines after END certificate
   - Proper file permissions (chmod 400)

#### Certificate Permission Problems
✓ **Check:**
```bash
ls -l /home/iotmaster/basicstation-docker/tc.*
```

🔧 **Solution:**
```bash
chmod 400 /home/iotmaster/basicstation-docker/tc.*
chown iotmaster:iotmaster /home/iotmaster/basicstation-docker/tc.*
```

## Connectivity Issues

### Gateway Not Connecting to Chirp LNS

#### Check Connection Status
```bash
docker logs -f basicstation-docker_basicstation_1 | grep -i "connected"
```

✓ **Verify:**
1. Gateway EUI registration
2. LNS URL correct for region
3. Certificates properly uploaded
4. Network connectivity

🔧 **Solution:**
1. Verify Gateway EUI matches registration
2. Check certificate validity
3. Confirm network connectivity:
   ```bash
   ping lora-eu868.cloud.chirpwireless.io
   ```

### Network Connectivity Issues

#### Gateway Not Accessible on Network
✓ **Check:**
```bash
ip addr show
ping 8.8.8.8
```

🔧 **Solution:**
1. Check ethernet connection
2. Verify network settings:
   ```bash
   cat /etc/dhcpcd.conf
   ```
3. Restart networking:
   ```bash
   sudo systemctl restart dhcpcd
   ```

## Region-Specific Issues

### Frequency Plan Mismatch
⚠️ **Symptoms:**
- No packets received
- "Invalid frequency" errors

🔧 **Solution:**
1. Verify region in config.json
2. Update frequency settings:
   - EU868: 867.1 - 868.5 MHz
   - US915: 902.3 - 914.9 MHz

## Performance Issues

### Poor Reception
✓ **Check:**
- Antenna connection
- Gateway placement
- Interference sources

🔧 **Solution:**
1. Improve antenna placement
2. Use outdoor antenna if possible
3. Check for metal objects near antenna
4. Verify antenna matching frequency plan

### System Resource Issues
✓ **Check:**
```bash
top
df -h
```

🔧 **Solution:**
1. Clear logs:
   ```bash
   docker system prune
   ```
2. Check SD card space
3. Monitor system temperature:
   ```bash
   vcgencmd measure_temp
   ```

## Getting Help

If issues persist:

1. **Gather Information:**
   ```bash
   # System information
   uname -a
   # Docker status
   docker ps -a
   # Basic Station logs
   docker logs basicstation-docker_basicstation_1
   # Web interface logs
   journalctl -u hubconfig
   ```

2. **Create GitHub Issue:**
   - Include all relevant logs
   - Describe the problem
   - List steps to reproduce
   - Include hardware details
   - Specify region/frequency plan

3. **Emergency Recovery:**
   ```bash
   # Stop all services
   docker-compose down
   # Backup certificates
   cp /home/iotmaster/basicstation-docker/tc.* /home/iotmaster/backup/
   # Reset Basic Station
   docker-compose up -d
   ```

## Prevention

To prevent future issues:
1. Always connect antennas before power
2. Use web interface for certificate management
3. Keep system updated:
   ```bash
   sudo apt update
   sudo apt upgrade
   ```
4. Monitor logs regularly
5. Backup certificates and configurations
