# Repository Structure

```bash
IoT-Hub/
|-- webconfig/                     # Web Interface (Go)
|   |-- static/                   # Static web assets
|   |   |-- index.html           # Main web interface
|   |   `-- style.css            # Styling
|   |-- main.go                  # Go backend code
|   |-- go.mod                   # Go module definition
|   `-- README.md                # Web interface documentation
|
|-- docs/                          # Documentation
|   |-- api.md                    # API documentation
|   |-- configuration.md          # Configuration guide
|   |-- hardware-setup.md         # Hardware setup guide
|   |-- software-setup.md         # Software installation guide
|   `-- troubleshooting.md        # Common issues and solutions
|
|-- config/                        # Configuration files
|   |-- basicstation.service      # Basic Station service definition
|   |-- config.json               # Configuration file
|   |-- tc.crt                    # Certificate file
|   |-- tc.key                    # Key file
|   |-- tc.trust                  # Trust file
|   |-- tc.uri                    # URI file
|   `-- webconfig.service         # Web config service definition
|
|-- docker/                        # Docker configurations
|   `-- docker-compose.yml        # Docker Compose file
|
|-- scripts/                       # Utility scripts
|   `-- fix_certs.sh              # Certificate fix script
|
|-- .gitignore                    # Git ignore file
|-- README.md                     # Main project documentation
|-- README_MATTER.md              # Matter protocol documentation
|-- README_OTBR.md                # OpenThread Border Router documentation
`-- README_ZIGBEE.md              # Zigbee protocol documentation
```

## Directory Descriptions

### `/webconfig`
The main web interface application written in Go, providing configuration and management capabilities for the IoT Hub.
- `static/`: Contains the web frontend (HTML, CSS)
- `main.go`: Backend server implementation
- `go.mod`: Go module dependencies

### `/docs`
Contains all project documentation, including API documentation, configuration guides, setup guides, troubleshooting information, and hardware specifications.

### `/config`
Configuration files and service definitions, including certificates and service files.

### `/docker`
Docker-related configurations, including the docker-compose.yml file for containerized deployments.

### `/scripts`
Utility scripts for maintenance of the IoT Hub, including certificate management.

## File Descriptions

### Key Files
- `README.md`: Main project documentation and quick start guide
- `README_MATTER.md`: Documentation for Matter protocol integration
- `README_OTBR.md`: Documentation for OpenThread Border Router integration
- `README_ZIGBEE.md`: Documentation for Zigbee protocol integration
- `.gitignore`: Specifies which files Git should ignore
- `webconfig/main.go`: Main web interface server
- `docker/docker-compose.yml`: Docker composition for services
- `config/basicstation.service`: Systemd service definition for Basic Station
- `config/webconfig.service`: Systemd service definition for Web Configuration
- `scripts/fix_certs.sh`: Script for fixing certificate issues
- `docs/api.md`: API documentation and reference
- `docs/configuration.md`: Configuration documentation
- `docs/hardware-setup.md`: Detailed hardware setup instructions
- `docs/software-setup.md`: Software installation and configuration guide
- `docs/troubleshooting.md`: Common issues and solutions

## Notes for Contributors
1. Keep documentation up-to-date with code changes
2. Follow the existing directory structure when adding new features
3. Update the REPOSITORY_STRUCTURE.md file when making structural changes
4. For web interface changes:
   - Test all changes locally before committing
   - Update both frontend and backend documentation
   - Follow Go coding standards
   - Keep the UI responsive and mobile-friendly
5. When adding new protocols or integrations, create a dedicated README file (e.g., README_PROTOCOL.md)
