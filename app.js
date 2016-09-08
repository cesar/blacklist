'use strict'

const list = require('./lib/list')
const cluster = require('cluster')
const REFRESH_PERIOD = parseInt(process.env.REFRESH_PERIOD) || 720000
const path = require('path')
const pathToLists = path.join(__dirname, 'blocklist-ipsets')

if (cluster.isMaster) {
  const http = require('http')
  let server
  let blocklist

  list.fetch(pathToLists).then(() => {
    return list.load(pathToLists)
  }).then(list => {
    blocklist = list
    server = http.createServer(requestHandler)
    server.listen(8080, () => {
      console.log('Server is listening')
    })
    setInterval(function () {
      console.log('Time for a refresh')
      cluster.fork()
    }, REFRESH_PERIOD)
  }).catch(err => {
    console.trace(err)
    console.log(err)
  })

  function requestHandler (request, response) {
    let data = []
    let flag = false
    request.on('data', function (chunk) {
      data.push(chunk)
    }).on('end', function () {
      data = Buffer.concat(data).toString()
      let match = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/.exec(data)
      if (match) {
        data = match[0].trim() // Extract the ip
        flag = blocklist.contains(data)
        let resObj = {
          address: data
        }
        if (flag) {
          response.writeHead(200, {'Content-Type': 'application/json'})
          resObj.blacklisted = true
          resObj.message = 'IP currently blacklisted'
          resObj.time = Date.now()
        } else {
          response.writeHead(404, {'Content-Type': 'application/json'})
          resObj.blacklisted = false
        }
        response.end(JSON.stringify(resObj))
      } else {
        response.writeHead(400, {'Content-Type': 'text/html'})
        response.end()
      }
    })
  }
  // update the list in memory
  cluster.on('message', message => {
    list.load(pathToLists).then(list => {
      blocklist = list
    }).catch(err => {
      console.trace(err)
    })
  })
} else {
  // Update the list
  list.fetch(pathToLists).then(() => {
    process.send('List update', () => {
      process.exit(0)
    })
  })
}
