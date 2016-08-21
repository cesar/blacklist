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

let listPath = path.join(__dirname, 'blocklist-ipsets')

const REFRESH_PERIOD = parseInt(process.env.REFRESH_PERIOD) || 720000

if (cluster.isMaster) {
  let workerQueue = []

  list.fetch(listPath).then(() => {
    const cores = require('os').cpus().length > 3 ? 3 : require('os').cpus().length
    for (var i = 0; i < cores; i++) {
      cluster.fork()
    }
    // Update the repo and notify the processes
    setInterval(function () {
      console.log('Time for a refresh')
      list.fetch(listPath).then(() => {
        for (let id in cluster.workers) {
          workerQueue.push(cluster.workers[id]) // Fill the queu of workers
        }
        workerQueue.pop().send('refresh') // Start the refresh process
      }).catch(err => {
        console.error(err)
      })
    }, REFRESH_PERIOD) // Every 12 mins

  }).catch(err => {
    console.error(err)
    process.exit(0)
  })

  //Restart a worker that has failed
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.id} has died, restarting...`)
    cluster.fork()
  })

  // Worker just refreshed a list, on to the next one
  cluster.on('message', (message) => {
    if (workerQueue.length > 0) workerQueue.pop().send('refresh')
    console.log(message)
  })

} else {

  const http = require("http")
  let server
  let blocklist

  // Bootstrap
  list.load(listPath).then(result => {
    blocklist = result
    server = http.createServer(requestHandler)
    server.listen(3000, () => {
      console.log("Server is listening")
      process.send('process-started')
    })
  }).catch(err => {
    console.error(err)
    process.exit(0)
  })

  // refresh
  process.on('message', (msg) => {
    if (msg === 'refresh') {
      server.close(() => {
        // Connections closed
        console.log('Connection closed, exiting')
        process.exit(0)
      })
    }
  })

  // On Error, shutdown process
  process.on('error', err => {
    console.log(err)
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
}
