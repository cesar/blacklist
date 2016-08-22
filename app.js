'use strict'

//  TODO: Configure startup script using `npm start`
//  TODO: Add flag to indicate which lists are loaded (all or base case)
//  TODO: Create a README.md
//  TODO: Test whether error on master tries to fork more processes
//  TODO: Switch from Vinyl to Glob module for looking at files
//  TODO: Automated tests
//  TODO: Configure Prod
//  TODO: Handle case where a worker gets killed

const list = require('./lib/list')
const path = require('path')
const cluster = require('cluster')
const listPath = process.env.LIST_PATH || path.join(__dirname, 'blocklist-ipsets')
const REFRESH_PERIOD = parseInt(process.env.REFRESH_PERIOD) || 720000
let server

if (cluster.isMaster) {
  const http = require("http")
  let blocklist

  list.fetch(listPath, false).then(() => {
    list.load(listPath).then(result => {
      blocklist = result
      server = http.createServer(requestHandler)
      server.listen(8080, () => {
        console.log("Server is listening")
      })
      setInterval(function () {
        console.log('Time for a refresh')
        cluster.fork()
      }, REFRESH_PERIOD)
    }).catch(err => {
      console.error(err)
      process.exit(0)
    })
  }).catch(err => {
    console.log(err)
    console.error('Failed to fetch list')
    process.exit(0)
  })

  function requestHandler (request, response) {
    let data = []
    let flag = false
    request.on('data', function(chunk) {
      data.push(chunk);
    }).on('end', function() {
      data = Buffer.concat(data).toString();
      let match = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/.exec(data)
      if (match) {
        data = match[0].trim() //Extract the ip
        flag = blocklist.contains(data)
        let resObj = {
          address: data
        }
        if (flag) {
          response.writeHead(200, {"Content-Type": "application/json"})
          resObj.blacklisted = true
          resObj.message = 'IP currently blacklisted'
          resObj.time = Date.now()
        } else {
          response.writeHead(404, {"Content-Type": "application/json"})
          resObj.blacklisted = false
        }
        response.end(JSON.stringify(resObj))
      } else {
        response.writeHead(400, {"Content-Type": "text/html"})
        response.end()
      }
    });
  }


  // update the list in memory
  cluster.on('message', message => {
    list.load(listPath).then(result => {
      blocklist = result
    }).catch(err => {
      console.error(err)
    })
  });

} else {
  // Update the list
  list.fetch(listPath, false).then(() => {
    process.send('List update', () => {
      process.exit(0)
    })
  }).catch(err => {
    console.error(err)
    process.exit(0)
  })
}
