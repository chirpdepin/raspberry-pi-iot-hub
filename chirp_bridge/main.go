package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"gopkg.in/yaml.v3"
)

// Config structure for storing configuration
type Config struct {
	LocalMQTT struct {
		Mode                 string `yaml:"mode"`
		Zigbee2MQTTConfigPath string `yaml:"zigbee2mqtt_config_path"`
		Server               string `yaml:"server"`
		Port                 int    `yaml:"port"`
		BaseTopic            string `yaml:"base_topic"`
		Username             string `yaml:"username"`
		Password             string `yaml:"password"`
	} `yaml:"local_mqtt"`

	CloudMQTT struct {
		Server    string `yaml:"server"`
		Port      int    `yaml:"port"`
		BaseTopic string `yaml:"base_topic"`
		Username  string `yaml:"username"`
		Password  string `yaml:"password"`
		UseTLS    bool   `yaml:"use_tls"`
	} `yaml:"cloud_mqtt"`
}

// MQTTBridge structure for storing bridge state
type MQTTBridge struct {
	config      Config
	localClient mqtt.Client
	cloudClient mqtt.Client
}

// NewMQTTBridge creates a new instance of MQTT bridge
func NewMQTTBridge(configPath string) (*MQTTBridge, error) {
	// Load configuration
	config, err := loadConfig(configPath)
	if err != nil {
		return nil, fmt.Errorf("error loading configuration: %w", err)
	}

	bridge := &MQTTBridge{
		config: config,
	}

	// Create local MQTT client
	localOpts := mqtt.NewClientOptions()
	localOpts.AddBroker(fmt.Sprintf("tcp://%s:%d", config.LocalMQTT.Server, config.LocalMQTT.Port))
	localOpts.SetClientID("chirp_bridge_local")
	if config.LocalMQTT.Username != "" {
		localOpts.SetUsername(config.LocalMQTT.Username)
		localOpts.SetPassword(config.LocalMQTT.Password)
	}
	localOpts.SetAutoReconnect(true)
	localOpts.SetConnectionLostHandler(func(client mqtt.Client, err error) {
		log.Printf("Connection to local MQTT lost: %v", err)
	})
	localOpts.SetOnConnectHandler(func(client mqtt.Client) {
		log.Println("Connected to local MQTT broker")
	})

	// Create cloud MQTT client
	cloudOpts := mqtt.NewClientOptions()
	protocol := "tcp"
	if config.CloudMQTT.UseTLS {
		protocol = "ssl"
	}
	cloudOpts.AddBroker(fmt.Sprintf("%s://%s:%d", protocol, config.CloudMQTT.Server, config.CloudMQTT.Port))
	cloudOpts.SetClientID("chirp_bridge_cloud")
	if config.CloudMQTT.Username != "" {
		cloudOpts.SetUsername(config.CloudMQTT.Username)
		cloudOpts.SetPassword(config.CloudMQTT.Password)
	}
	cloudOpts.SetAutoReconnect(true)
	cloudOpts.SetConnectionLostHandler(func(client mqtt.Client, err error) {
		log.Printf("Connection to cloud MQTT lost: %v", err)
	})
	cloudOpts.SetOnConnectHandler(func(client mqtt.Client) {
		log.Println("Connected to cloud MQTT broker")
	})

	// Initialize clients
	bridge.localClient = mqtt.NewClient(localOpts)
	bridge.cloudClient = mqtt.NewClient(cloudOpts)

	return bridge, nil
}

// Start launches the MQTT bridge
func (b *MQTTBridge) Start() error {
	// Connect to local MQTT
	if token := b.localClient.Connect(); token.Wait() && token.Error() != nil {
		return fmt.Errorf("error connecting to local MQTT: %w", token.Error())
	}

	// Connect to cloud MQTT
	if token := b.cloudClient.Connect(); token.Wait() && token.Error() != nil {
		return fmt.Errorf("error connecting to cloud MQTT: %w", token.Error())
	}

	// Subscribe to all local zigbee2mqtt messages
	localTopic := b.config.LocalMQTT.BaseTopic + "/#"
	if token := b.localClient.Subscribe(localTopic, 0, b.handleLocalMessage); token.Wait() && token.Error() != nil {
		return fmt.Errorf("error subscribing to local topic %s: %w", localTopic, token.Error())
	}
	log.Printf("Subscribed to local topic: %s", localTopic)

	// Subscribe to all cloud zigbee2mqtt messages
	cloudTopic := b.config.CloudMQTT.BaseTopic + "/#"
	if token := b.cloudClient.Subscribe(cloudTopic, 0, b.handleCloudMessage); token.Wait() && token.Error() != nil {
		return fmt.Errorf("error subscribing to cloud topic %s: %w", cloudTopic, token.Error())
	}
	log.Printf("Subscribed to cloud topic: %s", cloudTopic)

	return nil
}

// Stop terminates the MQTT bridge
func (b *MQTTBridge) Stop() {
	if b.localClient != nil && b.localClient.IsConnected() {
		b.localClient.Disconnect(250)
	}
	if b.cloudClient != nil && b.cloudClient.IsConnected() {
		b.cloudClient.Disconnect(250)
	}
	log.Println("MQTT bridge stopped")
}

// handleLocalMessage processes messages from local MQTT and forwards them to the cloud
func (b *MQTTBridge) handleLocalMessage(client mqtt.Client, msg mqtt.Message) {
	// Get relative topic path
	topic := msg.Topic()
	relTopic := strings.TrimPrefix(topic, b.config.LocalMQTT.BaseTopic)

	// Create corresponding cloud topic
	cloudTopic := b.config.CloudMQTT.BaseTopic + relTopic

	// Forward message to cloud
	if token := b.cloudClient.Publish(cloudTopic, 0, false, msg.Payload()); token.Wait() && token.Error() != nil {
		log.Printf("Error forwarding to cloud (topic %s): %v", cloudTopic, token.Error())
		return
	}

	log.Printf("Forwarded to cloud: %s -> %s", topic, cloudTopic)
}

// handleCloudMessage processes messages from cloud MQTT and forwards them locally
func (b *MQTTBridge) handleCloudMessage(client mqtt.Client, msg mqtt.Message) {
	// Get relative topic path
	topic := msg.Topic()
	relTopic := strings.TrimPrefix(topic, b.config.CloudMQTT.BaseTopic)

	// Create corresponding local topic
	localTopic := b.config.LocalMQTT.BaseTopic + relTopic

	// Forward message locally
	if token := b.localClient.Publish(localTopic, 0, false, msg.Payload()); token.Wait() && token.Error() != nil {
		log.Printf("Error forwarding locally (topic %s): %v", localTopic, token.Error())
		return
	}

	log.Printf("Forwarded locally: %s -> %s", topic, localTopic)
}

// Zigbee2MQTTConfig represents the structure of Zigbee2MQTT configuration file
type Zigbee2MQTTConfig struct {
	Version int `yaml:"version"`
	MQTT    struct {
		BaseTopic string `yaml:"base_topic"`
		Server    string `yaml:"server"`
	} `yaml:"mqtt"`
}

// loadConfig loads configuration from file
func loadConfig(configPath string) (Config, error) {
	var config Config

	data, err := os.ReadFile(configPath)
	if err != nil {
		return config, fmt.Errorf("error reading configuration file: %w", err)
	}

	err = yaml.Unmarshal(data, &config)
	if err != nil {
		return config, fmt.Errorf("error parsing configuration file: %w", err)
	}

	// If auto mode is enabled, load settings from Zigbee2MQTT configuration
	if config.LocalMQTT.Mode == "auto" {
		err = loadZigbee2MQTTConfig(&config)
		if err != nil {
			return config, fmt.Errorf("error loading Zigbee2MQTT configuration: %w", err)
		}
	}

	return config, nil
}

// loadZigbee2MQTTConfig loads MQTT settings from Zigbee2MQTT configuration file
func loadZigbee2MQTTConfig(config *Config) error {
	if config.LocalMQTT.Zigbee2MQTTConfigPath == "" {
		return fmt.Errorf("Zigbee2MQTT configuration path is not specified")
	}

	// Read Zigbee2MQTT configuration file
	data, err := os.ReadFile(config.LocalMQTT.Zigbee2MQTTConfigPath)
	if err != nil {
		return fmt.Errorf("error reading Zigbee2MQTT configuration file: %w", err)
	}

	// Parse Zigbee2MQTT configuration
	var z2mConfig Zigbee2MQTTConfig
	err = yaml.Unmarshal(data, &z2mConfig)
	if err != nil {
		return fmt.Errorf("error parsing Zigbee2MQTT configuration file: %w", err)
	}

	// Extract MQTT server and port from the server URL
	serverURL := z2mConfig.MQTT.Server
	if strings.HasPrefix(serverURL, "mqtt://") {
		serverURL = strings.TrimPrefix(serverURL, "mqtt://")
	}

	// Parse server and port
	parts := strings.Split(serverURL, ":")
	config.LocalMQTT.Server = parts[0]
	if len(parts) > 1 {
		port, err := strconv.Atoi(parts[1])
		if err == nil {
			config.LocalMQTT.Port = port
		}
	}

	// Set base topic
	config.LocalMQTT.BaseTopic = z2mConfig.MQTT.BaseTopic

	log.Printf("Loaded MQTT configuration from Zigbee2MQTT: server=%s, port=%d, base_topic=%s", 
		config.LocalMQTT.Server, config.LocalMQTT.Port, config.LocalMQTT.BaseTopic)

	return nil
}

func main() {
	log.Println("Starting Chirp Bridge MQTT Bridge")

	configPath := "config.yaml"
	if len(os.Args) > 1 {
		configPath = os.Args[1]
	}

	// Create and start MQTT bridge
	bridge, err := NewMQTTBridge(configPath)
	if err != nil {
		log.Fatalf("Error creating MQTT bridge: %v", err)
	}

	if err := bridge.Start(); err != nil {
		log.Fatalf("Error starting MQTT bridge: %v", err)
	}

	// Wait for signal to properly terminate
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Println("Termination signal received, stopping MQTT bridge...")
	bridge.Stop()
}
