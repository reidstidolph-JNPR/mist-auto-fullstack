require 'json'
require 'net/http'
require 'uri'

# Import environment details from env.json
env = JSON.parse(File.read('env.json'))

# Set token in auth header for API calls
rest_req_config = { 'Authorization' => "Token #{env['token']}" }

# Prompt the user for input
def question(prompt)
  print prompt
  gets.chomp
end

# Get sites
def get_sites(env, rest_req_config)
  url = URI("#{env['baseUrl']}/orgs/#{env['orgId']}/sites")
  puts "\n>>> GET #{url}\n"

  request = Net::HTTP::Get.new(url)
  rest_req_config.each { |key, value| request[key] = value }

  response = Net::HTTP.start(url.hostname, url.port, use_ssl: url.scheme == "https") do |http|
    http.request(request)
  end

  JSON.parse(response.body)
rescue => e
  puts e.message
  exit 1
end

# Create site
def create_site(site, env, rest_req_config)
  site_settings = {
    "name" => site['name'],
    "gatewaytemplate_id" => site['gatewaytemplate_id'],
    "networktemplate_id" => site['networktemplate_id'],
    "timezone" => env['siteSettings']['timezone'],
    "country_code" => env['siteSettings']['country_code'],
    "address" => env['siteSettings']['address'],
    "latlng" => env['siteSettings']['latlng']
  }

  url = URI("#{env['baseUrl']}/orgs/#{env['orgId']}/sites")
  puts "Creating site '#{site['name']}'..."
  puts "\n>>> POST #{url}\nPayload:\n#{JSON.pretty_generate(site_settings)}\n"

  request = Net::HTTP::Post.new(url, 'Content-Type' => 'application/json')
  rest_req_config.each { |key, value| request[key] = value }
  request.body = site_settings.to_json

  response = Net::HTTP.start(url.hostname, url.port, use_ssl: url.scheme == "https") do |http|
    http.request(request)
  end

  JSON.parse(response.body)
rescue => e
  puts e.message
  exit 1
end

# Modify site settings
def modify_site(site_id, vars, env, rest_req_config)
  puts 'Applying additional site settings...'
  site_settings = { "vars" => vars }

  url = URI("#{env['baseUrl']}/sites/#{site_id}/setting")
  puts "\n>>> PUT #{url}\nPayload:\n#{JSON.pretty_generate(site_settings)}\n"

  request = Net::HTTP::Put.new(url, 'Content-Type' => 'application/json')
  rest_req_config.each { |key, value| request[key] = value }
  request.body = site_settings.to_json

  Net::HTTP.start(url.hostname, url.port, use_ssl: url.scheme == "https") do |http|
    http.request(request)
  end
rescue => e
  puts e.message
  exit 1
end

# Assign a device from inventory to a site
def assign_device_to_site(site_id, devices, env, rest_req_config)
  payload = {
    "op" => "assign",
    "site_id" => site_id,
    "macs" => devices,
    "managed" => true,
    "disable_auto_config" => false
  }

  url = URI("#{env['baseUrl']}/orgs/#{env['orgId']}/inventory")
  puts "\n>>> PUT #{url}\nPayload:\n#{JSON.pretty_generate(payload)}\n"

  request = Net::HTTP::Put.new(url, 'Content-Type' => 'application/json')
  rest_req_config.each { |key, value| request[key] = value }
  request.body = payload.to_json

  response = Net::HTTP.start(url.hostname, url.port, use_ssl: url.scheme == "https") do |http|
    http.request(request)
  end

  JSON.parse(response.body)
rescue => e
  puts e.message
  exit 1
end

# Get device inventory
def get_devices(env, rest_req_config)
  puts 'Getting devices from inventory...'
  url = URI("#{env['baseUrl']}/orgs/#{env['orgId']}/inventory?unassigned=true")
  puts "\n>>> GET #{url}\n"

  request = Net::HTTP::Get.new(url)
  rest_req_config.each { |key, value| request[key] = value }

  response = Net::HTTP.start(url.hostname, url.port, use_ssl: url.scheme == "https") do |http|
    http.request(request)
  end

  JSON.parse(response.body)
rescue => e
  puts e.message
  exit 1
end

# Read devices file from disk
def read_file(file_path)
  puts "Reading '#{file_path}' from disk..."
  File.readlines(file_path, chomp: true)
rescue
  nil
end

# Read devices from user
def read_devices_from_user(unassigned_devices)
  puts 'Unassigned devices in inventory:'
  puts 'mac            serial         type'
  puts '-----------------------------------------'
  unassigned_devices.each do |device|
    puts "#{device['mac']} | #{device['serial']} | #{device['type']} #{device['sku']}"
  end
  puts ''

  devices_from_user = question('Enter "," separated list of device MACs to add to site:')
  devices_from_user.split(',')
end

# Sanitize and validate an array of device MAC addresses
def validate_macs(devices)
  sanitized_macs = []
  regex = /^([0-9a-f]){12}$/

  devices.each do |device_mac|
    def quit_on_bad_file_data(error)
      puts "#{error}. Exiting."
      exit 1
    end

    if device_mac.empty?
      quit_on_bad_file_data('Device data invalid, empty string found')
    end

    sanitized_mac = device_mac.strip.downcase.delete(':')

    unless sanitized_mac.match?(regex)
      quit_on_bad_file_data("Invalid device MAC detected: '#{device_mac}'")
    end

    sanitized_macs << sanitized_mac
  end

  sanitized_macs.uniq
end

# Main script control
def main(env, rest_req_config)
  site_name = question('Enter a site name:')
  sites = get_sites(env, rest_req_config)

  if sites.any? { |site| site['name'] == site_name }
    puts "Site name '#{site_name}' already exists. Exiting."
    exit 1
  end

  new_site = create_site({
    "name" => site_name,
    "gatewaytemplate_id" => env['gatewaytemplate_id'],
    "wlantemplate_id" => env['wlantemplate_id'],
    "networktemplate_id" => env['networktemplate_id']
  }, env, rest_req_config)

  puts "Site '#{new_site['name']}' build complete!"

  modify_site(new_site['id'], env['siteSettings']['vars'], env, rest_req_config) if env['siteSettings']['vars']

  unassigned_devices = get_devices(env, rest_req_config)

  if unassigned_devices.empty?
    puts 'No unassigned devices in inventory, exiting.'
    exit 0
  end

  devices_to_add = read_file('./devices.txt') || read_devices_from_user(unassigned_devices)
  devices_to_add = validate_macs(devices_to_add)

  devices_to_add.each do |device|
    unless unassigned_devices.any? { |unassigned| unassigned['mac'] == device }
      puts "Device '#{device}' does not exist in unassigned inventory. Exiting."
      exit 0
    end
  end

  assignment_results = assign_device_to_site(new_site['id'], devices_to_add, env, rest_req_config)
  puts "Devices added to site '#{new_site['name']}': #{assignment_results['success'].size}"

  if assignment_results['error']
    puts 'The following devices encountered errors:'
    assignment_results['error'].each_with_index do |error, index|
      puts "Device: '#{error}' Error: #{assignment_results['reason'][index]}"
    end
  end

  puts "\nAutomated site build complete!\n"
end

main(env, rest_req_config)
