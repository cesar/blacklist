# ADS - Anomaly Detection Service

ADS is a small microservice used to verify wether an IP address is part of an IP black list. The services makes use of Firehol's [blocklist-ipsets](https://github.com/firehol/blocklist-ipsets). 

## Installation

```
$: git clone https://github.com/sezalcru/ads
$: npm install
```
The service will take a while to set up as it first needs to fetch the blocklist. Once the list is fetched, the service will fork worker processes to handle the requests, on port 3000. The amount of server workers will depend on the amount of CPU cores. Once the service is operational, the list will be refreshed every 12 mins.

## Usage


##### Starting the service

```
$: npm start
```

By default, only the contents of the firehol vetted lists will be added into the service, to load the contents of the entire list:

```
$: FULL_LIST=true node index
```

This will load the entire contents of the list into memory, this can cause a lot of false positive results, see [here](http://iplists.firehol.org/).

Optionally, the refresh period for the list can be modified using the REFRESH_PERIOD env variable (period is expected to be in ms):

```
$: REFRESH_PERIOD=300000 node index.js
```


##### Usage

To determin whether an IP address is part of a list, simply make an HTTP POST request to the base app url:

```
POST http://localhost:3000/
```

The body should be of type: `application/x-www-form-urlencoded` and contain the body:

```
{
  "address": <ip>
}
```

Where `<ip>` is the IP address to check in string format. The service will respond in one of two ways:

`200 OK` - If the address is indeed contained in one of the blacklists

`404 Not Found` - If the address is not contained in the list

## Tests

Tests are executed using [ava](https://github.com/avajs/ava). To run tests, simply:
 
```
$: npm test
```

Also, a script is provided which generates random IP addresses to test against the list in successive iterations. To execute, simply:

```
$: node scripts/test_list.js
```

The script will output to stdout the total amount of tests and the hits and misses. 

Additionally, running:

```
$: npm run ab
```

Will perform a benchmark test using Apache AB tool, the configuration values are available in the `package.json` file.


TODO: Pending Tasks
---

- More tests
- Better logs
- Incorporate Glob module
