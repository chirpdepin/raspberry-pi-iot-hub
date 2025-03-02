# Senses IoT Hub Configuration Interface

A web-based configuration interface for the Senses IoT Hub by Chirp, designed specifically for Raspberry Pi running RAK5146 LoRaWAN gateway. This tool simplifies the process of connecting to Chirp's LNS (LoRaWAN Network Server) by providing an intuitive web interface for certificate management and configuration.

## Features

- User-friendly web interface for certificate management
- Automatic Gateway EUI detection from ethernet MAC
- Secure certificate handling and storage
- Automatic Basic Station container management
- Seamless integration with Chirp's LNS (app.chirpwireless.io)

## Prerequisites

- Raspberry Pi 4
- RAK5146 (SX1303) HAT
- Docker and Docker Compose installed
- Basic Station container set up in `/home/iotmaster/basicstation-docker/`

## Installation

1. Create the required directory structure:
```bash
mkdir -p /home/iotmaster/hubconfig/static
```

2. Copy the files:
```bash
# Copy the web interface files
cp static/index.html /home/iotmaster/hubconfig/static/
cp static/style.css /home/iotmaster/hubconfig/static/

# Build and copy the binary
GOOS=linux GOARCH=arm GOARM=7 go build -o hubconfig
cp hubconfig /home/iotmaster/hubconfig/
```

3. Set up as a system service:
```bash
sudo nano /etc/systemd/system/hubconfig.service
```

Add the following content:
```ini
[Unit]
Description=Senses IoT Hub Configuration Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/iotmaster/hubconfig
ExecStart=/home/iotmaster/hubconfig/hubconfig
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable hubconfig
sudo systemctl start hubconfig
```

## Usage

### Setting up your Gateway

1. Access the web interface at `http://<raspberry-pi-ip>`
2. The interface will display your Gateway EUI

### Generating Certificates on Chirp

1. Log in to [app.chirpwireless.io](https://app.chirpwireless.io)
2. Navigate to "Gateways" section
3. Click "Add Gateway" in the upper right corner
4. Select "3rd Party Gateway"
5. Enter the Gateway EUI shown in your Raspberry Pi's web interface
6. Save the generated certificates to your local machine:
   - Root CA Certificate (tc.trust)
   - Gateway Certificate (tc.crt)
   - Gateway Private Key (tc.key)
7. Note the LNS Address shown below the gateway name - you'll need this in the next step

### Configuring the Gateway

1. Return to your Raspberry Pi's web interface
2. Enter the LNS Address copied from Chirp's website
3. Upload the three certificate files using the file selection buttons
4. Click "Upload & Start"
5. Wait a few minutes for the gateway to connect
6. Refresh your gateway page on app.chirpwireless.io
7. Your gateway should now show as connected

### Next Steps

Once your gateway is connected, you're ready to:
- Deploy and automate sensors
- Monitor gateway status through Chirp's interface
- Start collecting LoRaWAN data

## Directory Structure

```
/hubconfig/
├── main.go                # Go server implementation
├── hubconfig             # Compiled binary
├── README.md             # This file
└── static/
    ├── index.html        # Web interface
    └── style.css         # Styling
```

## Development

To build the binary for Raspberry Pi:
```bash
set GOOS=linux
set GOARCH=arm
set GOARM=7
go build -o hubconfig
```

## Contributing

We welcome contributions from the community! Here's how you can contribute:

### Getting Started

1. Fork the repository
2. Create a new branch for your feature: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Test your changes thoroughly
5. Submit a Pull Request

### Guidelines

- **Code Style**: Follow Go's official style guide and use `gofmt`
- **Documentation**: Update README.md if you're adding new features or changing functionality
- **Commit Messages**: Write clear, concise commit messages describing your changes
- **Testing**: Add tests for new features when possible
- **Branch Names**: Use descriptive branch names (e.g., `feature/add-https-support`, `fix/certificate-permissions`)

### Types of Contributions

We're looking for help with:
- Bug fixes
- New features
- Documentation improvements
- UI/UX enhancements
- Security improvements
- Performance optimizations

### Questions or Issues?

- Open an issue for bugs or feature requests
- Join our discussions for questions
- Check existing issues before creating new ones

## License

MIT License

Copyright (c) 2025 Chirp

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
