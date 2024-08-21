'use strict'
// modules
const rest = require('axios')
const question = require('./lib/question')

// import org details from env.json
const apiToken = require('./env.json').token
const orgId = require('./env.json').orgId
const envBaseUrl = require('./env.json').envBaseUrl
const gatewaytemplate_id = require('./env.json').gatewaytemplate_id
const wlantemplate_id = require('./env.json').wlantemplate_id
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
    let newSite = await rest.post(`${envBaseUrl}/orgs/${orgId}/sites`, siteSettings, restReqConfig)

    // add site to wlan template
    console.log('getting wlan template...')
    let wlanTemplate = await rest.get(`${envBaseUrl}/orgs/${orgId}/templates/${wlantemplate_id}`, restReqConfig)

    // add site to wlan template
    console.log(`adding site '${newSite.data.name}' to template '${wlanTemplate.data.name}'...`)
    wlanTemplate.data.applies.site_ids.push(newSite.data.id)
    await rest.put(`${envBaseUrl}/orgs/${orgId}/templates/${wlantemplate_id}`, {applies: wlanTemplate.data.applies}, restReqConfig)

    // return
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
    wlantemplate_id: wlantemplate_id,
    networktemplate_id: networktemplate_id
  })
  
  console.log(`site '${newSite.name}' build complete!`)

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