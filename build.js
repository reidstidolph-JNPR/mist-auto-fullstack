'use strict'
// modules
const rest = require('axios')
const fs = require('fs').promises
const question = require('./lib/question')

// import environment details from env.json
const env = require('./env.json')
const restReqConfig = { headers: { Authorization: `Token ${env.token}` } }

// get sites
async function getSites(){

  try {
    // get sites 
    let sites = await rest.get(`${env.baseUrl}/orgs/${env.orgId}/sites`, restReqConfig)
    return sites.data

  } catch (error) {

    console.error(error)
    process.exit(1)
  }

}

// create site
async function createSite(site) {

  // create settings for initial site creation
  let siteSettings = {
    name: site.name,
    gatewaytemplate_id: site.gatewaytemplate_id,
    networktemplate_id: site.networktemplate_id,
    // hard coded site location data
    timezone: "America/Denver",
    country_code: "US",
    address: "Denver, CO, USA",
    latlng: {
        lat: 39.739236,
        lng: -104.990251
    }
  }

  try {
    // create site
    console.log('creating site...')
    let newSite = await rest.post(`${env.baseUrl}/orgs/${env.orgId}/sites`, siteSettings, restReqConfig)

    // add site to wlan template
    console.log('getting wlan template...')
    let wlanTemplate = await rest.get(`${env.baseUrl}/orgs/${env.orgId}/templates/${env.wlantemplate_id}`, restReqConfig)

    // add site to wlan template
    console.log(`adding site '${newSite.data.name}' to template '${wlanTemplate.data.name}'...`)
    wlanTemplate.data.applies.site_ids.push(newSite.data.id)
    await rest.put(`${env.baseUrl}/orgs/${env.orgId}/templates/${env.wlantemplate_id}`, {applies: wlanTemplate.data.applies}, restReqConfig)

    // return
    return newSite.data

  } catch (error) {

    console.error(error)
    process.exit(1)
  }

}

// assign a devices from inventory to a site
async function assignDeviceToSite(site_id, devices) {

  console.log(`assigning devices from inventory to site...`)
  let payload = {
    op: "assign",
    site_id: site_id,
    macs: devices,
    managed: true,
    disable_auto_config: false
  }

  try {
    // assign device to site
    let inventoryAssignment = await rest.put(`${env.baseUrl}/orgs/${env.orgId}/inventory`, payload, restReqConfig)
    return inventoryAssignment.data

  } catch (error) {

    console.error(error)
    process.exit(1)
  }
}

// get device inventory
async function getDevices() {

  console.log('getting devices from inventory...')
  try {
    // get device inventory
    let inventory = await rest.get(`${env.baseUrl}/orgs/${env.orgId}/inventory?unassigned=true`, restReqConfig)
    return inventory.data

  } catch (error) {

    console.error(error)
    process.exit(1)
  }

}

// read devices file from disk
async function readFile(filePath) {

  console.log(`reading '${filePath}' from disk...`)
  try {

    // read file
    let devices = await fs.readFile(filePath, 'utf8')

    // create array with each line a separate entry
    devices = devices.split('\n')

    return devices

  } catch (err) {

    // unable to open file data
    return null

  }
}

// read devices from user
async function readDevicesFromUser(unassignedDevices){
  // prompt user to input devices
  console.log('unassigned devices in inventory:')
  console.log('mac            serial         type       ')
  console.log('-----------------------------------------')
  unassignedDevices.forEach(device => {
    console.log(`${device.mac} | ${device.serial} | ${device.type} ${device.sku}`)
  })
  console.log('')

  // get devices from user
  let devicesFromUser = await question('Enter "," separated list of device MACs to add to site:')
  // parse CSV into array of device MACs
  devicesFromUser = devicesFromUser.split(",")

  return devicesFromUser
}

// sanitize and validate an array of device MAC addresses
function validateMacs(devices){

  let sanitizedMacs = []
  // sanitize 
  devices.forEach(deviceMac => {

    // bail out function
    function quitOnBadFileData(error){
      console.error(`${error}. Exiting.`)
      process.exit(1)
    }

    // check for empty string
    if (deviceMac.length === 0) { 
      quitOnBadFileData('device data invalid, empty string found')
    }

    // remove any whitespace, colons, and convert to lowercase
    let sanitizedMac = deviceMac.replace(/[\s:]+/g, '').toLowerCase()

    // check for valid mac address
    const regex = /^([0-9a-f]){12}$/
    if (!regex.test(sanitizedMac)) {
      quitOnBadFileData(`invalid device mac detected: '${deviceMac}'`)
    }

    sanitizedMacs.push(sanitizedMac)
  })

  // de-duplicate
  sanitizedMacs = [...new Set(sanitizedMacs)]

  return sanitizedMacs
}

// main script control
async function main() {

  // ask for site name
  let siteName = await question('Enter a site name:')

  // check to see that another site with same name does not exist
  let sites = await getSites()
  if (sites.find(site => site.name ===siteName)) {
    console.error(`site name '${siteName}' already exists. Exiting.`)
    process.exit(1)
  }

  // create site
  console.log(`creating new site named '${siteName}'...`)
  let newSite = await createSite({
    name: siteName,
    gatewaytemplate_id: env.gatewaytemplate_id,
    wlantemplate_id: env.wlantemplate_id,
    networktemplate_id: env.networktemplate_id
  })
  
  console.log(`site '${newSite.name}' build complete!`)

  // get unassigned devices from inventory
  let unassignedDevices = await getDevices()

  // if there are no unassigned devices in iventory, exit
  if (unassignedDevices.length === 0) {
    console.log('no unassigned devices in inventory, exiting.')
    process.exit(0)
  }

  // create variable for devices to add to site, to be assigned from user or file later
  let devicesToAdd

  // check for device file
  let deviceFromFile = await readFile('./devices.txt')

  if (deviceFromFile === null) {

    // prompt user to input devices
    let devicesFromUser = await readDevicesFromUser(unassignedDevices)

    // sanitize and validate devices from user
    devicesToAdd = validateMacs(devicesFromUser)

  } else {

    // sanitize and validate devices from file
    devicesToAdd = validateMacs(deviceFromFile)
  }

  // make sure each device exists in unassigned inventory
  devicesToAdd.forEach(device => {
    let deviceInUnassigned = unassignedDevices.find(unassignedDevice => unassignedDevice.mac === device)
    if (!deviceInUnassigned || Object.keys(deviceInUnassigned).length === 0) {
      console.log(`device '${device}' does not exist in unassigned inventory. Exiting.`)
      process.exit(0)
    }
  })
  
  // add devices to site
  let assignmentResults = await assignDeviceToSite(newSite.id, devicesToAdd)
  console.log(`devices added to site '${newSite.name}': ${assignmentResults.success.length}`)

  // handle any site assignment errors
  if (assignmentResults.error.length > 0) {
    // print errors
    console.log('the following devices encountered errors:')
    for (let i = 0; i < assignmentResults.error; i++) {
      console.log(`device: '${assignmentResults.error[i]}' error: ${assignmentResults.reason[i]}`)
    }
  }
  
  // done
  console.log('\nautomated site build complete!\n')

}

main()