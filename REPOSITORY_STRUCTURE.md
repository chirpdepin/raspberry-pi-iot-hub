# Repository Structure

IoT-Hub/
├── hubconfig/                     # Web Interface (Go)
│   ├── static/                   # Static web assets
│   │   ├── index.html           # Main web interface
│   │   └── style.css            # Styling
│   ├── main.go                  # Go backend code
│   ├── go.mod                   # Go module definition
│   └── README.md                # Web interface documentation
│
├── docs/                          # Documentation
│   ├── images/                    # Documentation images
│   ├── hardware-setup.md         # Hardware setup guide
│   ├── software-setup.md         # Software installation guide
│   └── troubleshooting.md       # Common issues and solutions
│
├── config/                        # Configuration templates
│   ├── basicstation/            # Basic Station configurations
│   │   ├── docker-compose.yml
│   │   └── basicstation.service
│   └── certificates/            # Certificate templates and scripts
│       └── fix_certs.sh
│
├── scripts/                       # Utility scripts
│   ├── install.sh               # Installation script
│   └── setup-certificates.sh    # Certificate setup script
│
├── examples/                     # Example configurations
│   └── config.json.example
│
├── .gitignore                    # Git ignore file
├── LICENSE                       # Project license
└── README.md                     # Main project documentation

## Directory Descriptions

### `/hubconfig`
The main web interface application written in Go, providing configuration and management capabilities for the IoT Hub.
- `static/`: Contains the web frontend (HTML, CSS)
- `main.go`: Backend server implementation
- `go.mod`: Go module dependencies

### `/docs`
Contains all project documentation, including setup guides, troubleshooting information, and hardware specifications.

### `/config`
Template configuration files and service definitions. These are the base configurations that users will need to modify with their specific settings.

### `/scripts`
Utility scripts for installation, setup, and maintenance of the IoT Hub.

### `/examples`
Example configuration files and templates that users can use as reference.

## File Descriptions

### Key Files
- `README.md`: Main project documentation and quick start guide
- `LICENSE`: Project license information
- `.gitignore`: Specifies which files Git should ignore
- `hubconfig/main.go`: Main web interface server
- `config/basicstation/docker-compose.yml`: Docker composition for Basic Station
- `config/basicstation/basicstation.service`: Systemd service definition
- `scripts/install.sh`: Main installation script
- `docs/hardware-setup.md`: Detailed hardware setup instructions
- `docs/software-setup.md`: Software installation and configuration guide

## Notes for Contributors
1. Always use template files with `.example` extension for configuration files
2. Never commit actual certificates or keys
3. Keep documentation up-to-date with code changes
4. Follow the existing directory structure when adding new features
5. For web interface changes:
   - Test all changes locally before committing
   - Update both frontend and backend documentation
   - Follow Go coding standards
   - Keep the UI responsive and mobile-friendly
