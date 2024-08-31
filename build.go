package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"regexp"
	"strings"
)

// Env struct holds the environment details
type Env struct {
	Token             string `json:"token"`
	BaseURL           string `json:"baseUrl"`
	OrgID             string `json:"orgId"`
	GatewayTemplateID string `json:"gatewaytemplate_id"`
	WlanTemplateID    string `json:"wlantemplate_id"`
	NetworkTemplateID string `json:"networktemplate_id"`
	SiteSettings      struct {
		Timezone    string             `json:"timezone"`
		CountryCode string             `json:"country_code"`
		Address     string             `json:"address"`
		LatLng      map[string]float64 `json:"latlng"`
		Vars        map[string]string  `json:"vars"`
	} `json:"siteSettings"`
}

var env Env

func init() {
	// Load environment details from env.json
	file, err := os.Open("env.json")
	if err != nil {
		fmt.Println("Error opening env.json:", err)
		os.Exit(1)
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&env); err != nil {
		fmt.Println("Error decoding env.json:", err)
		os.Exit(1)
	}
}

// Get input from the user
func question(prompt string) string {
	var input string
	fmt.Print(prompt)
	fmt.Scanln(&input)
	return input
}

// Get sites
func getSites() []map[string]interface{} {
	url := fmt.Sprintf("%s/orgs/%s/sites", env.BaseURL, env.OrgID)
	fmt.Printf("\n>>> GET %s\n\n", url)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Println("Error creating request:", err)
		os.Exit(1)
	}

	req.Header.Set("Authorization", "Token "+env.Token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error making request:", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("Error reading response body:", err)
		os.Exit(1)
	}

	var sites []map[string]interface{}
	if err := json.Unmarshal(body, &sites); err != nil {
		fmt.Println("Error unmarshaling JSON:", err)
		os.Exit(1)
	}

	return sites
}

// Create site
func createSite(site map[string]interface{}) map[string]interface{} {
	siteSettings := map[string]interface{}{
		"name":               site["name"],
		"gatewaytemplate_id": site["gatewaytemplate_id"],
		"networktemplate_id": site["networktemplate_id"],
		"timezone":           env.SiteSettings.Timezone,
		"country_code":       env.SiteSettings.CountryCode,
		"address":            env.SiteSettings.Address,
		"latlng":             env.SiteSettings.LatLng,
	}

	url := fmt.Sprintf("%s/orgs/%s/sites", env.BaseURL, env.OrgID)
	fmt.Printf("Creating site '%s'...\n", site["name"])

	// Pretty-print the payload using MarshalIndent
	payload, err := json.MarshalIndent(siteSettings, "", "  ")
	if err != nil {
		fmt.Println("Error marshaling JSON:", err)
		os.Exit(1)
	}
	fmt.Printf("\n>>> POST %s\nPayload:\n%s\n", url, payload)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))
	if err != nil {
		fmt.Println("Error creating request:", err)
		os.Exit(1)
	}

	req.Header.Set("Authorization", "Token "+env.Token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error making request:", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("Error reading response body:", err)
		os.Exit(1)
	}

	var newSite map[string]interface{}
	if err := json.Unmarshal(body, &newSite); err != nil {
		fmt.Println("Error unmarshaling JSON:", err)
		os.Exit(1)
	}

	return newSite
}

// Modify site settings
func modifySite(siteID string, vars map[string]string) {
	fmt.Println("Applying additional site settings...")
	siteSettings := map[string]interface{}{"vars": vars}

	url := fmt.Sprintf("%s/sites/%s/setting", env.BaseURL, siteID)

	// Pretty-print the payload using MarshalIndent
	payload, err := json.MarshalIndent(siteSettings, "", "  ")
	if err != nil {
		fmt.Println("Error marshaling JSON:", err)
		os.Exit(1)
	}
	fmt.Printf("\n>>> PUT %s\nPayload:\n%s\n", url, payload)

	req, err := http.NewRequest("PUT", url, bytes.NewBuffer(payload))
	if err != nil {
		fmt.Println("Error creating request:", err)
		os.Exit(1)
	}

	req.Header.Set("Authorization", "Token "+env.Token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	_, err = client.Do(req)
	if err != nil {
		fmt.Println("Error making request:", err)
		os.Exit(1)
	}
}

// Assign a device from inventory to a site
func assignDeviceToSite(siteID string, devices []string) map[string]interface{} {
	payload := map[string]interface{}{
		"op":                  "assign",
		"site_id":             siteID,
		"macs":                devices,
		"managed":             true,
		"disable_auto_config": false,
	}

	url := fmt.Sprintf("%s/orgs/%s/inventory", env.BaseURL, env.OrgID)

	// Pretty-print the payload using MarshalIndent
	jsonPayload, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		fmt.Println("Error marshaling JSON:", err)
		os.Exit(1)
	}
	fmt.Printf("\n>>> PUT %s\nPayload:\n%s\n", url, jsonPayload)

	req, err := http.NewRequest("PUT", url, bytes.NewBuffer(jsonPayload))
	if err != nil {
		fmt.Println("Error creating request:", err)
		os.Exit(1)
	}

	req.Header.Set("Authorization", "Token "+env.Token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error making request:", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("Error reading response body:", err)
		os.Exit(1)
	}

	var assignment map[string]interface{}
	if err := json.Unmarshal(body, &assignment); err != nil {
		fmt.Println("Error unmarshaling JSON:", err)
		os.Exit(1)
	}

	return assignment
}

// Get device inventory
func getDevices() []map[string]interface{} {
	fmt.Println("Getting devices from inventory...")
	url := fmt.Sprintf("%s/orgs/%s/inventory?unassigned=true", env.BaseURL, env.OrgID)
	fmt.Printf("\n>>> GET %s\n\n", url)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Println("Error creating request:", err)
		os.Exit(1)
	}

	req.Header.Set("Authorization", "Token "+env.Token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error making request:", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("Error reading response body:", err)
		os.Exit(1)
	}

	var inventory []map[string]interface{}
	if err := json.Unmarshal(body, &inventory); err != nil {
		fmt.Println("Error unmarshaling JSON:", err)
		os.Exit(1)
	}

	return inventory
}

// Read devices file from disk
func readFile(filePath string) []string {
	fmt.Printf("Reading '%s' from disk...\n", filePath)
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return nil
	}
	return strings.Split(string(content), "\n")
}

// Read devices from user
func readDevicesFromUser(unassignedDevices []map[string]interface{}) []string {
	fmt.Println("Unassigned devices in inventory:")
	fmt.Println("mac            serial         type")
	fmt.Println("-----------------------------------------")
	for _, device := range unassignedDevices {
		fmt.Printf("%s | %s | %s %s\n", device["mac"], device["serial"], device["type"], device["sku"])
	}
	fmt.Println("")

	devicesFromUser := question("Enter \",\" separated list of device MACs to add to site:")
	return strings.Split(devicesFromUser, ",")
}

// Sanitize and validate an array of device MAC addresses
func validateMacs(devices []string) []string {
	var sanitizedMacs []string
	regex := regexp.MustCompile(`^([0-9a-f]){12}$`)

	for _, deviceMac := range devices {
		if deviceMac == "" {
			fmt.Println("Device data invalid, empty string found. Exiting.")
			os.Exit(1)
		}

		sanitizedMac := strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(deviceMac, " ", ""), ":", ""))
		if !regex.MatchString(sanitizedMac) {
			fmt.Printf("Invalid device MAC detected: '%s'. Exiting.\n", deviceMac)
			os.Exit(1)
		}

		sanitizedMacs = append(sanitizedMacs, sanitizedMac)
	}

	// De-duplicate
	keys := make(map[string]bool)
	var uniqueMacs []string
	for _, mac := range sanitizedMacs {
		if _, value := keys[mac]; !value {
			keys[mac] = true
			uniqueMacs = append(uniqueMacs, mac)
		}
	}

	return uniqueMacs
}

// Main script control
func main() {
	siteName := question("Enter a site name:")
	sites := getSites()

	for _, site := range sites {
		if site["name"] == siteName {
			fmt.Printf("Site name '%s' already exists. Exiting.\n", siteName)
			os.Exit(1)
		}
	}

	newSite := createSite(map[string]interface{}{
		"name":               siteName,
		"gatewaytemplate_id": env.GatewayTemplateID,
		"wlantemplate_id":    env.WlanTemplateID,
		"networktemplate_id": env.NetworkTemplateID,
	})

	fmt.Printf("Site '%s' build complete!\n", newSite["name"])

	if len(env.SiteSettings.Vars) > 0 {
		modifySite(newSite["id"].(string), env.SiteSettings.Vars)
	}

	unassignedDevices := getDevices()

	if len(unassignedDevices) == 0 {
		fmt.Println("No unassigned devices in inventory, exiting.")
		os.Exit(0)
	}

	devicesToAdd := readFile("./devices.txt")
	if devicesToAdd == nil {
		devicesToAdd = readDevicesFromUser(unassignedDevices)
	}
	devicesToAdd = validateMacs(devicesToAdd)

	for _, device := range devicesToAdd {
		found := false
		for _, unassigned := range unassignedDevices {
			if device == unassigned["mac"] {
				found = true
				break
			}
		}
		if !found {
			fmt.Printf("Device '%s' does not exist in unassigned inventory. Exiting.\n", device)
			os.Exit(0)
		}
	}

	assignmentResults := assignDeviceToSite(newSite["id"].(string), devicesToAdd)
	fmt.Printf("Devices added to site '%s': %d\n", newSite["name"], len(assignmentResults["success"].([]interface{})))

	if errors, ok := assignmentResults["error"]; ok && len(errors.([]interface{})) > 0 {
		fmt.Println("The following devices encountered errors:")
		for i, err := range errors.([]interface{}) {
			fmt.Printf("Device: '%s' Error: %s\n", err, assignmentResults["reason"].([]interface{})[i])
		}
	}

	fmt.Println("\nAutomated site build complete!\n")
}
