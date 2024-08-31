<?php

// Import environment details from env.json
$env = json_decode(file_get_contents('env.json'), true);

// Set token in auth header for API calls
$restReqConfig = [
    'http' => [
        'header' => "Authorization: Token " . $env['token']
    ]
];

// Prompt the user for input
function question($prompt) {
    echo $prompt;
    return trim(fgets(STDIN));
}

// Get sites
function getSites() {
    global $env, $restReqConfig;

    try {
        $url = $env['baseUrl'] . "/orgs/" . $env['orgId'] . "/sites";
        echo "\n>>> GET $url\n";
        $response = file_get_contents($url, false, stream_context_create($restReqConfig));
        return json_decode($response, true);
    } catch (Exception $e) {
        echo $e->getMessage();
        exit(1);
    }
}

// Create site
function createSite($site) {
    global $env, $restReqConfig;

    $siteSettings = [
        "name" => $site['name'],
        "gatewaytemplate_id" => $site['gatewaytemplate_id'],
        "networktemplate_id" => $site['networktemplate_id'],
        "timezone" => $env['siteSettings']['timezone'],
        "country_code" => $env['siteSettings']['country_code'],
        "address" => $env['siteSettings']['address'],
        "latlng" => $env['siteSettings']['latlng']
    ];

    try {
        $url = $env['baseUrl'] . "/orgs/" . $env['orgId'] . "/sites";
        echo "Creating site '{$site['name']}'...\n";
        echo "\n>>> POST $url\nPayload:\n" . json_encode($siteSettings, JSON_PRETTY_PRINT) . "\n";

        $options = $restReqConfig;
        $options['http']['method'] = "POST";
        $options['http']['header'] .= "\r\nContent-Type: application/json";
        $options['http']['content'] = json_encode($siteSettings);

        $response = file_get_contents($url, false, stream_context_create($options));
        return json_decode($response, true);
    } catch (Exception $e) {
        echo $e->getMessage();
        exit(1);
    }
}

// Modify site settings
function modifySite($site, $vars) {
    global $env, $restReqConfig;

    echo "Applying additional site settings...\n";
    $siteSettings = ["vars" => $vars];

    try {
        $url = $env['baseUrl'] . "/sites/$site/setting";
        echo "\n>>> PUT $url\nPayload:\n" . json_encode($siteSettings, JSON_PRETTY_PRINT) . "\n";

        $options = $restReqConfig;
        $options['http']['method'] = "PUT";
        $options['http']['header'] .= "\r\nContent-Type: application/json";
        $options['http']['content'] = json_encode($siteSettings);

        file_get_contents($url, false, stream_context_create($options));
    } catch (Exception $e) {
        echo $e->getMessage();
        exit(1);
    }
}

// Assign a device from inventory to a site
function assignDeviceToSite($site_id, $devices) {
    global $env, $restReqConfig;

    $payload = [
        "op" => "assign",
        "site_id" => $site_id,
        "macs" => $devices,
        "managed" => true,
        "disable_auto_config" => false
    ];

    try {
        $url = $env['baseUrl'] . "/orgs/" . $env['orgId'] . "/inventory";
        echo "\n>>> PUT $url\nPayload:\n" . json_encode($payload, JSON_PRETTY_PRINT) . "\n";

        $options = $restReqConfig;
        $options['http']['method'] = "PUT";
        $options['http']['header'] .= "\r\nContent-Type: application/json";
        $options['http']['content'] = json_encode($payload);

        $response = file_get_contents($url, false, stream_context_create($options));
        return json_decode($response, true);
    } catch (Exception $e) {
        echo $e->getMessage();
        exit(1);
    }
}

// Get device inventory
function getDevices() {
    global $env, $restReqConfig;

    echo "Getting devices from inventory...\n";
    try {
        $url = $env['baseUrl'] . "/orgs/" . $env['orgId'] . "/inventory?unassigned=true";
        echo "\n>>> GET $url\n";
        $response = file_get_contents($url, false, stream_context_create($restReqConfig));
        return json_decode($response, true);
    } catch (Exception $e) {
        echo $e->getMessage();
        exit(1);
    }
}

// Read devices file from disk
function readFileFromDisk($filePath) {
    echo "Reading '$filePath' from disk...\n";
    try {
        return file($filePath, FILE_IGNORE_NEW_LINES);
    } catch (Exception $e) {
        return null;
    }
}

// Read devices from user
function readDevicesFromUser($unassignedDevices) {
    echo "Unassigned devices in inventory:\n";
    echo "mac            serial         type\n";
    echo "-----------------------------------------\n";
    foreach ($unassignedDevices as $device) {
        echo "{$device['mac']} | {$device['serial']} | {$device['type']} {$device['sku']}\n";
    }
    echo "\n";
    $devicesFromUser = question('Enter "," separated list of device MACs to add to site:');
    return explode(',', $devicesFromUser);
}

// Sanitize and validate an array of device MAC addresses
function validateMacs($devices) {
    $sanitizedMacs = [];
    $regex = '/^([0-9a-f]){12}$/';

    foreach ($devices as $deviceMac) {
        function quitOnBadFileData($error) {
            echo "$error. Exiting.\n";
            exit(1);
        }

        if (empty($deviceMac)) {
            quitOnBadFileData('Device data invalid, empty string found');
        }

        $sanitizedMac = strtolower(str_replace([' ', ':'], '', $deviceMac));

        if (!preg_match($regex, $sanitizedMac)) {
            quitOnBadFileData("Invalid device MAC detected: '$deviceMac'");
        }

        $sanitizedMacs[] = $sanitizedMac;
    }

    return array_unique($sanitizedMacs);
}

// Main script control
function main() {
    global $env;

    $siteName = question('Enter a site name:');
    $sites = getSites();

    foreach ($sites as $site) {
        if ($site['name'] === $siteName) {
            echo "Site name '$siteName' already exists. Exiting.\n";
            exit(1);
        }
    }

    $newSite = createSite([
        "name" => $siteName,
        "gatewaytemplate_id" => $env['gatewaytemplate_id'],
        "wlantemplate_id" => $env['wlantemplate_id'],
        "networktemplate_id" => $env['networktemplate_id']
    ]);

    echo "Site '{$newSite['name']}' build complete!\n";

    if (!empty($env['siteSettings']['vars'])) {
        modifySite($newSite['id'], $env['siteSettings']['vars']);
    }

    $unassignedDevices = getDevices();

    if (empty($unassignedDevices)) {
        echo "No unassigned devices in inventory, exiting.\n";
        exit(0);
    }

    $devicesToAdd = readFileFromDisk('./devices.txt') ?: readDevicesFromUser($unassignedDevices);
    $devicesToAdd = validateMacs($devicesToAdd);

    foreach ($devicesToAdd as $device) {
        $found = false;
        foreach ($unassignedDevices as $unassigned) {
            if ($device === $unassigned['mac']) {
                $found = true;
                break;
            }
        }
        if (!$found) {
            echo "Device '$device' does not exist in unassigned inventory. Exiting.\n";
            exit(0);
        }
    }

    $assignmentResults = assignDeviceToSite($newSite['id'], $devicesToAdd);
    echo "Devices added to site '{$newSite['name']}': " . count($assignmentResults['success']) . "\n";

    if (!empty($assignmentResults['error'])) {
        echo "The following devices encountered errors:\n";
        foreach ($assignmentResults['error'] as $index => $error) {
            echo "Device: '$error' Error: {$assignmentResults['reason'][$index]}\n";
        }
    }

    echo "\nAutomated site build complete!\n";
}

main();

?>
