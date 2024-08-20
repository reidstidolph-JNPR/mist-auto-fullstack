'use strict'
// modules
const rest = require('axios')

// import org details from env.json
const apiToken = require('./env.json').token
const orgId = require('./env.json').orgId
const envBaseUrl = require('./env.json').envBaseUrl
const restReqConfig = { headers: { Authorization: `Token ${apiToken}` } }


// create site
async function createSite() {}

// apply templates to site
async function applyTemplates() {}

// assign device to site
async function assignDeviceToSite() {}

// get device inventory
async function getDevices() {

  try {
    // get device inventory
    let inventory = await rest.get(`${envBaseUrl}/orgs/${orgId}/devices/search?type=gateway`, restReqConfig)
    return inventory.data.results

  } catch (error) {

    console.error(error)
    //bail out
    process.exit(1)
  }

}

// main script control
async function main() {

  let devices = await getDevices()
  console.log(devices)
}

main()