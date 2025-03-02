# IoT Hub API Documentation

This document describes the HTTP API endpoints available in the IoT Hub web interface. These endpoints can be used for automation, integration with other systems, or development of alternative interfaces.

## Base URL

All API endpoints are accessible at `http://[gateway-ip]`, where `[gateway-ip]` is the IP address of your Raspberry Pi.

## Endpoints

### 1. Get Gateway EUI

Retrieves the unique identifier for your gateway. This EUI is required when registering your gateway with Chirp's LNS.

```
GET /gateway-eui
```

#### Response

```json
{
    "eui": "E45F01FFFE111F64"
}
```

- `eui`: The gateway's unique identifier in the format `E45F01FFFE{6_last_digits}`

#### Error Response
```json
{
    "success": false,
    "error": "Failed to retrieve Gateway EUI"
}
```

### 2. Configure Gateway

Configures the gateway with certificates and LNS URL. This endpoint handles the upload of certificate files and updates the gateway configuration.

```
POST /configure
```

#### Request
Content-Type: `multipart/form-data`

Fields:
- `lns-url`: The URL of the LNS server (e.g., `wss://lora-eu868.cloud.chirpwireless.io:443`)
- `tc-trust`: Root CA certificate file
- `tc-crt`: Client certificate file
- `tc-key`: Private key file

#### Success Response
```json
{
    "success": true
}
```

#### Error Response
```json
{
    "success": false,
    "error": "Error message describing what went wrong"
}
```

#### Notes
- Certificate files must be in PEM format
- Line endings will be automatically converted to LF
- Files will be stored with 0400 permissions (read-only for owner)
- The Basic Station container will be automatically restarted after configuration

### 3. File Upload

Handles individual certificate file uploads. This endpoint is used for updating specific certificates without reconfiguring the entire gateway.

```
POST /file-upload
```

#### Request
Content-Type: `multipart/form-data`

Fields:
- `file`: The certificate file to upload
- `type`: Type of certificate (`tc.trust`, `tc.crt`, or `tc.key`)

#### Success Response
```json
{
    "success": true
}
```

#### Error Response
```json
{
    "success": false,
    "error": "Error message describing what went wrong"
}
```

## Integration Examples

### Python Example
```python
import requests

def get_gateway_eui(gateway_ip):
    response = requests.get(f"http://{gateway_ip}/gateway-eui")
    return response.json()["eui"]

def configure_gateway(gateway_ip, lns_url, trust_file, crt_file, key_file):
    files = {
        'tc-trust': open(trust_file, 'rb'),
        'tc-crt': open(crt_file, 'rb'),
        'tc-key': open(key_file, 'rb')
    }
    data = {'lns-url': lns_url}
    
    response = requests.post(
        f"http://{gateway_ip}/configure",
        files=files,
        data=data
    )
    return response.json()
```

### Curl Example
```bash
# Get Gateway EUI
curl http://[gateway-ip]/gateway-eui

# Configure Gateway
curl -X POST http://[gateway-ip]/configure \
  -F "lns-url=wss://lora-eu868.cloud.chirpwireless.io:443" \
  -F "tc-trust=@/path/to/tc.trust" \
  -F "tc-crt=@/path/to/tc.crt" \
  -F "tc-key=@/path/to/tc.key"
```

## Common Use Cases

1. **Automated Gateway Setup**
   - Retrieve Gateway EUI for registration
   - Upload certificates and configure LNS URL
   - Verify successful configuration

2. **Certificate Management**
   - Update individual certificates as needed
   - Maintain security best practices
   - Automate certificate rotation

3. **Integration with Home Automation**
   - Monitor gateway status
   - Integrate with existing systems
   - Create custom dashboards

## Error Handling

The API uses standard HTTP status codes:
- 200: Success
- 400: Bad Request (invalid input)
- 405: Method Not Allowed (wrong HTTP method)
- 500: Internal Server Error

All error responses include a JSON object with:
- `success`: false
- `error`: Description of what went wrong

## Security Considerations

1. The API is designed to run on your local network
2. There is no built-in authentication (rely on network security)
3. Certificate files are stored with restricted permissions
4. Sensitive data is only transmitted over local network

## Rate Limiting

Currently, there are no rate limits implemented. However, be mindful of system resources when making multiple requests.

## Support

For issues, questions, or contributions:
1. Open an issue on GitHub
2. Check existing documentation
3. Review common troubleshooting steps

Remember to never share your private keys or certificates when seeking support.
