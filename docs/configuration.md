# Configuration Guide

This guide explains how to configure your Senses IoT Hub for different regions and requirements.

## Regional Frequency Settings

The IoT Hub comes pre-configured for EU868 frequency plan. Below are configuration examples for the most common regions.

### EU868 (Default Configuration)
```json
{
    "sx1302_conf": {
        "radio_0": {
            "enable": true,
            "type": "SX1250",
            "freq": 867500000,
            "rssi_offset": -215.4,
            "tx_enable": true
        },
        "radio_1": {
            "enable": true,
            "type": "SX1250",
            "freq": 868500000,
            "rssi_offset": -215.4,
            "tx_enable": false
        },
        "chan_multiSF_0": {"enable": true, "radio": 1, "if": -400000},
        "chan_multiSF_1": {"enable": true, "radio": 1, "if": -200000},
        "chan_multiSF_2": {"enable": true, "radio": 1, "if": 0},
        "chan_multiSF_3": {"enable": true, "radio": 0, "if": -400000},
        "chan_multiSF_4": {"enable": true, "radio": 0, "if": -200000},
        "chan_multiSF_5": {"enable": true, "radio": 0, "if": 0},
        "chan_multiSF_6": {"enable": true, "radio": 0, "if": 200000},
        "chan_multiSF_7": {"enable": true, "radio": 0, "if": 400000}
    }
}
```

### US915
```json
{
    "sx1302_conf": {
        "radio_0": {
            "enable": true,
            "type": "SX1250",
            "freq": 904300000,
            "rssi_offset": -215.4,
            "tx_enable": true
        },
        "radio_1": {
            "enable": true,
            "type": "SX1250",
            "freq": 905000000,
            "rssi_offset": -215.4,
            "tx_enable": false
        },
        "chan_multiSF_0": {"enable": true, "radio": 1, "if": -400000},
        "chan_multiSF_1": {"enable": true, "radio": 1, "if": -200000},
        "chan_multiSF_2": {"enable": true, "radio": 1, "if": 0},
        "chan_multiSF_3": {"enable": true, "radio": 0, "if": -400000},
        "chan_multiSF_4": {"enable": true, "radio": 0, "if": -200000},
        "chan_multiSF_5": {"enable": true, "radio": 0, "if": 0},
        "chan_multiSF_6": {"enable": true, "radio": 0, "if": 200000},
        "chan_multiSF_7": {"enable": true, "radio": 0, "if": 400000}
    }
}
```

## Using the Web Interface

The web interface provides the easiest way to configure your gateway:

1. Access the interface at `http://<gateway-ip>`
2. Enter the LNS URL for your region:
   - EU868: `wss://lora-eu868.cloud.chirpwireless.io:443`
   - US915: `wss://lora-us915.cloud.chirpwireless.io:443`

3. Upload certificates:
   - The interface automatically formats certificates correctly
   - Proper permissions are set automatically
   - Basic Station service is restarted automatically

## Certificate Requirements

When using the web interface, certificates are automatically formatted correctly. If manually configuring:

1. Required Files:
   - `tc.trust`: Root CA certificate
   - `tc.crt`: Gateway certificate
   - `tc.key`: Gateway private key

2. Format Requirements:
   - PEM format (Base64 encoded DER)
   - Unix line endings (LF, not CRLF)
   - No trailing spaces
   - No empty lines after END certificate line

Example of correct certificate format:
```
-----BEGIN CERTIFICATE-----
MIIBxTCCAWugAwIBAgIQd0cHKqXEsp1h/jxLUV+HZTAKBggqhkjOPQQDAjA4MRYw
[... certificate content ...]
KCAgELMJqJkwCgYIKoZIzj0EAwIDSAAwRQIhAK0jN5HPhvhk9DQzKX/st9kM8Hz5
-----END CERTIFICATE-----
```

## Basic Station Configuration

The Basic Station service is pre-configured for optimal operation. The default configuration includes:

- SPI interface on `/dev/spidev0.0`
- Reset GPIO on pin 17
- Automatic reset handling
- Docker-based deployment

No additional changes are typically needed for the Basic Station configuration.

## Troubleshooting Configuration

If you encounter issues:

1. **Certificate Problems**
   - Use the web interface for automatic formatting
   - Check file permissions (should be 400)
   - Verify no extra spaces or lines in certificates

2. **Region Mismatch**
   - Verify frequency settings match your region
   - Confirm LNS URL matches your region
   - Check local regulations for allowed frequencies

3. **Connection Issues**
   - Verify Gateway EUI registration
   - Check certificate validity
   - Review Basic Station logs

## Support

For configuration issues:
1. Check the [Troubleshooting Guide](troubleshooting.md)
2. Review logs: `docker logs basicstation-docker_basicstation_1`
3. Create GitHub issue with:
   - Region and frequency settings
   - Error messages
   - Configuration files (without sensitive data)
