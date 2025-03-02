#!/bin/bash

# Create a temporary directory
mkdir -p /tmp/certs

# Convert certificates to proper PEM format with Unix line endings
for cert in tc.trust tc.crt tc.key; do
    # Convert to Unix line endings and ensure proper PEM format
    cat "$cert" | dos2unix > "/tmp/certs/$cert"
    
    # Set proper permissions
    if [ "$cert" = "tc.key" ]; then
        chmod 600 "/tmp/certs/$cert"
    else
        chmod 644 "/tmp/certs/$cert"
    fi
done

# Copy to basicstation directory
cp /tmp/certs/* /opt/basicstation/

# Clean up
rm -rf /tmp/certs

# Restart basicstation
docker restart basicstation
