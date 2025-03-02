package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type Response struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

type GatewayEUIResponse struct {
	EUI string `json:"eui"`
}

func main() {
	// Serve static files
	fs := http.FileServer(http.Dir("static"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))

	// Serve the main page
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.ServeFile(w, r, "static/index.html")
			return
		}
		http.NotFound(w, r)
	})

	// Handle configuration
	http.HandleFunc("/configure", handleConfigure)
	
	// Handle Gateway EUI requests
	http.HandleFunc("/gateway-eui", handleGatewayEUI)

	http.HandleFunc("/file-upload", handleFileUpload)

	port := ":80"
	fmt.Printf("Server starting on port %s...\n", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal(err)
	}
}

func handleConfigure(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form
	err := r.ParseMultipartForm(10 << 20) // 10 MB max memory
	if err != nil {
		sendError(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	// Get LNS URL
	lnsURL := r.FormValue("lns-url")
	if lnsURL == "" {
		sendError(w, "LNS URL is required", http.StatusBadRequest)
		return
	}

	// Create directory for certificates if it doesn't exist
	certDir := "/home/iotmaster/basicstation-docker"
	if err := os.MkdirAll(certDir, 0755); err != nil {
		sendError(w, "Failed to create certificate directory", http.StatusInternalServerError)
		return
	}

	// Handle file uploads
	files := map[string]string{
		"tc-trust": filepath.Join(certDir, "tc.trust"),
		"tc-crt":   filepath.Join(certDir, "tc.crt"),
		"tc-key":   filepath.Join(certDir, "tc.key"),
	}

	for formKey, destPath := range files {
		file, _, err := r.FormFile(formKey)
		if err != nil {
			sendError(w, fmt.Sprintf("Failed to get %s file", formKey), http.StatusBadRequest)
			return
		}
		defer file.Close()

		// Read file content
		content, err := ioutil.ReadAll(file)
		if err != nil {
			sendError(w, fmt.Sprintf("Failed to read %s file", formKey), http.StatusInternalServerError)
			return
		}

		// Convert CRLF to LF
		content = []byte(strings.ReplaceAll(string(content), "\r\n", "\n"))

		// Write file with proper permissions
		err = ioutil.WriteFile(destPath, content, 0400)
		if err != nil {
			sendError(w, fmt.Sprintf("Failed to write %s file", formKey), http.StatusInternalServerError)
			return
		}
	}

	// Update docker-compose.yml
	err = updateDockerCompose(certDir, lnsURL)
	if err != nil {
		sendError(w, "Failed to update docker-compose.yml: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Restart Docker container
	err = restartContainer()
	if err != nil {
		sendError(w, "Failed to restart container: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Send success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{Success: true})
}

func handleGatewayEUI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	eui, err := getGatewayEUI()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Success: false, Error: err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(GatewayEUIResponse{EUI: eui})
}

func getGatewayEUI() (string, error) {
    // Try reading from gateway_id.txt first
    eui, err := ioutil.ReadFile("/usr/local/rak/gateway-config/gateway_id.txt")
    if err == nil {
        return strings.TrimSpace(string(eui)), nil
    }

    // If that fails, try reading from eth0 MAC
    mac, err := ioutil.ReadFile("/sys/class/net/eth0/address")
    if err != nil {
        return "", fmt.Errorf("failed to get Gateway EUI: %v", err)
    }

    // Convert MAC to EUI format
    macStr := strings.TrimSpace(string(mac))
    macStr = strings.ReplaceAll(macStr, ":", "")
    
    // Insert FFFE in the middle (after first 6 characters)
    if len(macStr) >= 12 {
        return strings.ToUpper(macStr[:6] + "FFFE" + macStr[6:]), nil
    }
    
    return "", fmt.Errorf("invalid MAC address format")
}

func updateDockerCompose(certDir string, lnsURL string) error {
	dockerComposePath := filepath.Join(certDir, "docker-compose.yml")
	
	// Read current docker-compose.yml
	content, err := ioutil.ReadFile(dockerComposePath)
	if err != nil {
		return fmt.Errorf("failed to read docker-compose.yml: %v", err)
	}

	// Convert to string for easier manipulation
	composeContent := string(content)

	// Find and replace the SERVER URL line
	lines := strings.Split(composeContent, "\n")
	for i, line := range lines {
		if strings.Contains(line, "SERVER:") {
			lines[i] = fmt.Sprintf("      - SERVER=%s", lnsURL)
			break
		}
	}

	// Join lines back together
	newContent := strings.Join(lines, "\n")

	// Write back to file
	err = ioutil.WriteFile(dockerComposePath, []byte(newContent), 0644)
	if err != nil {
		return fmt.Errorf("failed to write docker-compose.yml: %v", err)
	}

	return nil
}

func restartContainer() error {
    // Change to the basicstation-docker directory
    cmd := exec.Command("/usr/bin/docker-compose", "down")
    cmd.Dir = "/home/iotmaster/basicstation-docker"
    if err := cmd.Run(); err != nil {
        return fmt.Errorf("failed to stop container: %v", err)
    }

    cmd = exec.Command("/usr/bin/docker-compose", "up", "-d")
    cmd.Dir = "/home/iotmaster/basicstation-docker"
    if err := cmd.Run(); err != nil {
        return fmt.Errorf("failed to start container: %v", err)
    }

    return nil
}

func backupCertificates() error {
    backupDir := "/home/iotmaster/certificate_backups"
    timestamp := time.Now().Format("20060102_150405")
    backupPath := filepath.Join(backupDir, "certs_"+timestamp)
    
    // Create backup directory if it doesn't exist
    if err := os.MkdirAll(backupDir, 0755); err != nil {
        return fmt.Errorf("failed to create backup directory: %v", err)
    }
    
    // Create backup subdirectory with timestamp
    if err := os.MkdirAll(backupPath, 0755); err != nil {
        return fmt.Errorf("failed to create backup subdirectory: %v", err)
    }
    
    // Copy existing certificates if they exist
    certFiles := []string{"tc.key", "tc.crt", "tc.uri"}
    for _, file := range certFiles {
        srcPath := filepath.Join("/home/iotmaster/basicstation-docker/certs", file)
        if _, err := os.Stat(srcPath); err == nil {
            destPath := filepath.Join(backupPath, file)
            input, err := ioutil.ReadFile(srcPath)
            if err != nil {
                return fmt.Errorf("failed to read %s: %v", file, err)
            }
            if err := ioutil.WriteFile(destPath, input, 0644); err != nil {
                return fmt.Errorf("failed to write backup of %s: %v", file, err)
            }
        }
    }
    return nil
}

func stopBasicStation() error {
    cmd := exec.Command("docker", "stop", "basicstation")
    if err := cmd.Run(); err != nil {
        // Ignore error if container is not running
        if !strings.Contains(err.Error(), "No such container") {
            return fmt.Errorf("failed to stop basicstation container: %v", err)
        }
    }
    return nil
}

func startBasicStation() error {
    cmd := exec.Command("docker", "start", "basicstation")
    if err := cmd.Run(); err != nil {
        return fmt.Errorf("failed to start basicstation container: %v", err)
    }
    return nil
}

func handleFileUpload(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    // Process file uploads
    files := map[string]string{
        "tc-trust": "/home/iotmaster/basicstation-docker/tc.trust",
        "tc-crt":   "/home/iotmaster/basicstation-docker/tc.crt",
        "tc-key":   "/home/iotmaster/basicstation-docker/tc.key",
    }

    for formKey, destPath := range files {
        file, _, err := r.FormFile(formKey)
        if err != nil {
            http.Error(w, fmt.Sprintf("Failed to get %s file: %v", formKey, err), http.StatusBadRequest)
            return
        }
        defer file.Close()

        content, err := ioutil.ReadAll(file)
        if err != nil {
            http.Error(w, fmt.Sprintf("Failed to read %s file: %v", formKey, err), http.StatusInternalServerError)
            return
        }

        // Convert CRLF to LF
        content = []byte(strings.ReplaceAll(string(content), "\r\n", "\n"))

        // Write file with proper permissions
        if err := ioutil.WriteFile(destPath, content, 0400); err != nil {
            http.Error(w, fmt.Sprintf("Failed to write %s file: %v", formKey, err), http.StatusInternalServerError)
            return
        }
    }

    // Stop the container
    cmd := exec.Command("docker-compose", "down")
    cmd.Dir = "/home/iotmaster/basicstation-docker"
    output, err := cmd.CombinedOutput()
    if err != nil {
        http.Error(w, fmt.Sprintf("Failed to stop container: %v\nOutput: %s", err, string(output)), http.StatusInternalServerError)
        return
    }

    // Start the container
    cmd = exec.Command("docker-compose", "up", "-d")
    cmd.Dir = "/home/iotmaster/basicstation-docker"
    output, err = cmd.CombinedOutput()
    if err != nil {
        http.Error(w, fmt.Sprintf("Failed to start container: %v\nOutput: %s", err, string(output)), http.StatusInternalServerError)
        return
    }

    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{
        "message": "Files uploaded successfully and Basic Station restarted",
    })
}

func sendError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(Response{Success: false, Error: message})
}
