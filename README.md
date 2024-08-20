# Mist Full Stack Site Builder

This app auto-builds a full stack site in Mist, complete with Wired, Wireless, and SSR WAN Edge.

## Prerequisites and Setup

1. Have Docker (and optionally `docker-compose`) installed.
2. Clone repo and `cd` to the directory
```
git clone https://github.com/reidstidolph-JNPR/mist-wan-override-finder.git && cd mist-wan-override-finder
```
3. Create a file called `env.json` with properties for `orgId`, `token` (API token), and `envBaseUrl` (base URL for API calls). Example:

```json
{
  "token": "ru5...E5f",
  "orgId": "1ec....f2e",
  "envBaseUrl": "https://api.mist.com/api/v1"
}
```

## Build and Run

Use 1 of the following 2 options run the script:

### with just Docker

Use this if you only have Docker.

1. Build a docker image:
```
docker build -t build-site .
```
2. Run it:
```
docker run --rm -v ./env.json:/home/node/app/env.json build-site
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

### with `docker-compose`

1. Use this is you have Docker + docker-compose.
```
docker-compose run --rm build-site
```

### Example output:
```
% docker run --rm build-site
getting sites...
getting WAN edge inventory...
getting device configs...
device config retrieved, processing...
2 of 2 devices with WAN edge site templates have device-level overrides.
details:
 - 'Sunnyvale-Spoke' at site 'Sunnyvale' has overwrites to the 'service_policies' setting
 - 'Las_Vegas-Spoke' at site 'Las Vegas' has overwrites to the 'path_preferences' setting
```

## Mist API Usage

This script uses the following Mist API endpoints:

### Inventory
This is queried to retrieve WAN edge device inventory, and used to determine what site each device is assigned to.
```
/api/v1/orgs/${orgId}/devices/search?type=gateway
```