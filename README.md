# Mist Full Stack Site Builder

This app auto-builds a full stack site in Mist, complete with Wired, Wireless, and SSR WAN Edge.

![mist-site-build](https://github.com/user-attachments/assets/4e2b4fc7-5253-4ef6-a3df-f39108762345)

Scripts and instructions are provided for several different environments: [Docker](#Docker), [Python](#Python), [Go](#Go), [NodeJS](#NodeJS), [PHP](#PHP), [Ruby](#Ruby).

## Get Started
1. clone repo and `cd` to the directory:
```
git clone https://github.com/reidstidolph-JNPR/mist-auto-fullstack.git && cd mist-auto-fullstack
```
2. Create a file called `env.json` with properties for:
* `orgId` - your org ID
* `token` - API token for your org
* `envBaseUrl` - base URL for API calls (varies depending on cloud)
* `gatewaytemplate_id` - SSR WAN template ID
* `wlantemplate_id` - Wireless template ID
* `networktemplate_id` - Switch template ID
* `siteSettings` -> `timezone` - site timezone
* `siteSettings` -> `country_code` - site country code
* `siteSettings` -> `address` - site address
* `siteSettings` -> `latlng` - site coordinates
* `siteSettings` -> `vars` (*optional*) - site variables

Example:

```json
{
  "token": "ru5...E5f",
  "orgId": "1ec....f2e",
  "baseUrl": "https://api.mist.com/api/v1",
  "gatewaytemplate_id": "82d7...bc7a",
  "wlantemplate_id": "2277...9cfe",
  "networktemplate_id": "56a4...ea19",
  "siteSettings": {
    "timezone": "America/Denver",
    "country_code": "US",
    "address": "Denver, CO, USA",
    "latlng": {
      "lat": 39.739236,
      "lng": -104.990251
    },
    "vars": {
      "foo": "bar"
    }
  }
}
```

Next, run the automation using [Docker](#Docker), [Python](#Python), [Go](#Go), [NodeJS](#NodeJS), [PHP](#PHP), or [Ruby](#Ruby).

## Docker

### Prerequisites and Setup

1. Have Docker (and optionally `docker-compose`) installed.
2. Have one or more devices you want to deploy using the automation, **claimed and unnassigned** in your Mist org inventory.

### Build and Run

Use 1 of the following 2 options run the script:

#### with just Docker

Use this if you only have Docker.

1. Build a docker image:
```
docker build -t build-site .
```
2. Run it:
```
docker run -it --rm -v ./env.json:/home/node/app/env.json build-site
```

This creates a one-time container based on the image, and destroys it when finished. 

Alternatively, to create as a persistent container:
```
docker create --name build-site -v ./env.json:/home/node/app/env.json build-site
```
Then to run subsequently:
```
docker start -i build-site
```

#### with `docker-compose`

1. Use this is you have Docker + docker-compose.
```
docker-compose run --rm build-site
```

## Python
### Setup
Install module dependencies:
```
pip3 install aiofiles
pip3 install aiohttp
pip3 install asyncio
```
### Run
Run the python version of the script:
```
python3 build.py
```

## NodeJS
### Setup
Install module dependencies:
```
npm install
```

### Run
Run the javascript version of the script:
```
node build.js
```

## Go
Run the golang version of the script:
```
go run build.go
```

## PHP
Run the PHP version of the script:
```
php build.php
```

## Ruby
Run the Ruby version of the script:
```
ruby build.rb
```

## Optional Usage
A list of devices can be fed into the automation script in one of two ways:
1. CLI prompted user input of comma-separated list (default)
2. A file in the script directory called `devices.txt`

If a `devices.txt` file is found, the script will not prompt for user input, and attempt to read from file. It expects the file to contain a device MACs, one per line. Example:
```
50c709979b5f
c878670c4bce
5433c601082e
```

## Mist API Usage

This script uses the following Mist API endpoints:

### Inventory
A `GET` to this endpoint is used to retrieve unassigned device inventory.

```
/api/v1/orgs/${orgId}/inventory?unassigned=true
```

A `POST` to this endpoint with devices is used to assign devices to a site.

```
/api/v1/orgs/${orgId}/inventory
```

### Sites
A `GET` to this endpoint is used to retrieve the list of sites. Used by script to ensure a site with the same name does not already exist.

A `POST` to this endpoint with site settings is used to create a new site.

```
/api/v1/orgs/${orgId}/sites
```

### WLAN Template

A `GET` and a `PUT` is made to this endpoint to modify existing sites associated with the WLAN template, adding the newly created site.

```
/api/v1/orgs/${orgId}/templates/${wlantemplate_id}
```
