'use strict'
// modules
const rest = require('axios')
const question = require('./lib/question')

// import org details from env.json
const apiToken = require('./env.json').token
const orgId = require('./env.json').orgId
const envBaseUrl = require('./env.json').envBaseUrl
const gatewaytemplate_id = require('./env.json').gatewaytemplate_id
const rftemplate_id = require('./env.json').rftemplate_id
const networktemplate_id = require('./env.json').networktemplate_id
const restReqConfig = { headers: { Authorization: `Token ${apiToken}` } }

// get sites
async function getSites(){

  try {
    // get sites 
    let sites = await rest.get(`${envBaseUrl}/orgs/${orgId}/sites`, restReqConfig)
    return sites.data

  } catch (error) {

    console.error(error)
    process.exit(1)
  }

}
// create site
async function createSite(site) {

  try {
    // get device inventory
    let newSite = await rest.post(`${envBaseUrl}/orgs/${orgId}/sites`, site, restReqConfig)
    return newSite.data

  } catch (error) {

    console.error(error)
    process.exit(1)
  }

}

// apply templates to site
async function applyTemplates() {}

// assign device to site
async function assignDeviceToSite() {}

// get device inventory
async function getDevices() {

  try {
    // get device inventory
    let inventory = await rest.get(`${envBaseUrl}/orgs/${orgId}/inventory`, restReqConfig)
    return inventory.data

  } catch (error) {

    console.error(error)
    process.exit(1)
  }

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
    gatewaytemplate_id: gatewaytemplate_id,
    rftemplate_id: rftemplate_id,
    networktemplate_id: networktemplate_id
  })
  console.log(newSite)

  /* get devices from inventory
  let devices = await getDevices()
  // filter array to only the unassigned devices
  devices = devices.filter(device => {
    // only keep devices with no assigned site_id
    if (device.site_id === null) {
      return device
    }
  })

  console.log(devices)
  */
}

main()