import aiohttp
import asyncio
import json
import aiofiles
import sys
import re

# Import environment details from env.json
with open('env.json') as f:
    env = json.load(f)

# Set token in auth header for API calls
rest_req_config = {'Authorization': f"Token {env['token']}"}

# Asynchronously prompt the user
async def question(prompt):
    return input(prompt)

# Get sites
async def get_sites():
    try:
        print(f"\n>>> GET {env['baseUrl']}/orgs/{env['orgId']}/sites\n")
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{env['baseUrl']}/orgs/{env['orgId']}/sites", headers=rest_req_config) as response:
                sites = await response.json()
                return sites
    except Exception as e:
        print(e)
        sys.exit(1)

# Create site
async def create_site(site):
    site_settings = {
        "name": site['name'],
        "gatewaytemplate_id": site['gatewaytemplate_id'],
        "networktemplate_id": site['networktemplate_id'],
        "timezone": env['siteSettings']['timezone'],
        "country_code": env['siteSettings']['country_code'],
        "address": env['siteSettings']['address'],
        "latlng": env['siteSettings']['latlng']
    }

    try:
        print(f"Creating site '{site['name']}'...")
        print(f"\n>>> POST {env['baseUrl']}/orgs/{env['orgId']}/sites\nPayload:\n{json.dumps(site_settings, indent=2)}\n")
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{env['baseUrl']}/orgs/{env['orgId']}/sites", json=site_settings, headers=rest_req_config) as response:
                new_site = await response.json()
                return new_site
    except Exception as e:
        print(e)
        sys.exit(1)

# Modify site settings
async def modify_site(site, vars):
    print('applying additional site settings...')
    site_settings = {"vars": vars}

    try:
        print(f"\n>>> PUT {env['baseUrl']}/sites/{site}/setting\nPayload:\n{json.dumps(site_settings, indent=2)}\n")
        async with aiohttp.ClientSession() as session:
            await session.put(f"{env['baseUrl']}/sites/{site}/setting", json=site_settings, headers=rest_req_config)
    except Exception as e:
        print(e)
        sys.exit(1)

# Assign a device from inventory to a site
async def assign_device_to_site(site_id, devices):
    payload = {
        "op": "assign",
        "site_id": site_id,
        "macs": devices,
        "managed": True,
        "disable_auto_config": False
    }

    try:
        print(f"\n>>> PUT {env['baseUrl']}/orgs/{env['orgId']}/inventory\nPayload:\n{json.dumps(payload, indent=2)}\n")
        async with aiohttp.ClientSession() as session:
            async with session.put(f"{env['baseUrl']}/orgs/{env['orgId']}/inventory", json=payload, headers=rest_req_config) as response:
                assignment = await response.json()
                return assignment
    except Exception as e:
        print(e)
        sys.exit(1)

# Get device inventory
async def get_devices():
    print('Getting devices from inventory...')
    try:
        print(f"\n>>> GET {env['baseUrl']}/orgs/{env['orgId']}/inventory?unassigned=true\n")
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{env['baseUrl']}/orgs/{env['orgId']}/inventory?unassigned=true", headers=rest_req_config) as response:
                inventory = await response.json()
                return inventory
    except Exception as e:
        print(e)
        sys.exit(1)

# Read devices file from disk
async def read_file(file_path):
    print(f"Reading '{file_path}' from disk...")
    try:
        async with aiofiles.open(file_path, 'r') as f:
            devices = await f.read()
        return devices.splitlines()
    except Exception:
        return None

# Read devices from user
async def read_devices_from_user(unassigned_devices):
    print('Unassigned devices in inventory:')
    print('mac            serial         type')
    print('-----------------------------------------')
    for device in unassigned_devices:
        print(f"{device['mac']} | {device['serial']} | {device['type']} {device['sku']}")
    print('')
    devices_from_user = await question('Enter "," separated list of device MACs to add to site:')
    return devices_from_user.split(',')

# Sanitize and validate an array of device MAC addresses
def validate_macs(devices):
    sanitized_macs = []
    regex = r'^([0-9a-f]){12}$'

    for device_mac in devices:
        def quit_on_bad_file_data(error):
            print(f"{error}. Exiting.")
            sys.exit(1)

        if not device_mac:
            quit_on_bad_file_data('Device data invalid, empty string found')

        sanitized_mac = device_mac.replace(" ", "").replace(":", "").lower()

        if not re.match(regex, sanitized_mac):
            quit_on_bad_file_data(f"Invalid device MAC detected: '{device_mac}'")

        sanitized_macs.append(sanitized_mac)

    return list(set(sanitized_macs))

# Main script control
async def main():
    site_name = await question('Enter a site name:')
    sites = await get_sites()

    if any(site['name'] == site_name for site in sites):
        print(f"Site name '{site_name}' already exists. Exiting.")
        sys.exit(1)
    else:
        print(f"No site name '{site_name}' exists in org.")

    new_site = await create_site({
        "name": site_name,
        "gatewaytemplate_id": env['gatewaytemplate_id'],
        "wlantemplate_id": env['wlantemplate_id'],
        "networktemplate_id": env['networktemplate_id']
    })

    print(f"Site '{new_site['name']}' build complete!")

    if 'vars' in env['siteSettings']:
        await modify_site(new_site['id'], env['siteSettings']['vars'])

    unassigned_devices = await get_devices()

    if not unassigned_devices:
        print('No unassigned devices in inventory, exiting.')
        sys.exit(0)

    devices_to_add = await read_file('./devices.txt') or await read_devices_from_user(unassigned_devices)
    devices_to_add = validate_macs(devices_to_add)

    for device in devices_to_add:
        if not any(device == unassigned['mac'] for unassigned in unassigned_devices):
            print(f"Device '{device}' does not exist in unassigned inventory. Exiting.")
            sys.exit(0)

    assignment_results = await assign_device_to_site(new_site['id'], devices_to_add)
    print(f"Devices added to site '{new_site['name']}': {len(assignment_results['success'])}")

    if assignment_results.get('error'):
        print('The following devices encountered errors:')
        for error, reason in zip(assignment_results['error'], assignment_results['reason']):
            print(f"Device: '{error}' Error: {reason}")

    print('\nAutomated site build complete!\n')

# Run the main function
asyncio.run(main())