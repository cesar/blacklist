'use strict'

//  TODO: Configure startup script using `npm start`
//  TODO: Add flag to indicate which lists are loaded (all or base case)
//  TODO: Create a README.md
//  TODO: Move from Express to HTTP
//  TODO: Test whether error on master tries to fork more processes
//  TODO: Switch from Vinyl to Glob module for looking at files
//  TODO: Automated tests
//  TODO: Configure Prod
//  TODO: Handle case where a worker gets killed

const express = require('express')
const app = express()
const multer = require('multer')
const upload = multer()
const list = require('./lib/list')
const path = require('path')
const cluster = require('cluster')

let listPath = path.join(__dirname, 'blocklist-ipsets')
const REFRESH_PERIOD = 1000 * 60 * 2

if (cluster.isMaster) {
  // Bootstrap - clone or pull the repo
  list.fetch(listPath)
  // Start workers and listen for messages containing notifyRequest
  const cores = require('os').cpus().length
  for (var i = 0; i < cores; i++) {
    cluster.fork()
  }
  // Update the repo and notify the processes
  setInterval(function () {
    list.fetch(listPath)
    for (let id in cluster.workers) {
      // Don't refresh them all at once
      setTimeout(() => {
        cluster.workers[id].send('refresh')
      }, 10000)
    }
  }, REFRESH_PERIOD) // Every 12 mins

  //Restart a worker that has failed
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.id} has died, restarting...`)
    cluster.fork()
  })

} else {
  let server
  let blocklist
  // Bootstrap
  list.load(function (err, list) {
    if (err) {
      console.log(err)
    }
    blocklist = list
    server = app.listen(3000, function () {
      console.log('Server up on worker: ' + cluster.worker.id)
    })
  })

  app.post('/check', upload.array(), function (req, res) {
    // TODO: check whether address is an actual IP (needed?)
    let result = blocklist.contains(req.body.address.trim())
    res.json({
      contains: result
    })
  })

  // refresh and swap
  process.on('message', (msg) => {
    if (msg === 'refresh') {
      console.log('refreshing')
      // TODO: Stop accepting requests until the list is update
      server.close(function(){
        list.load((err, list) => {
          if (err) {
            // TODO: Handle Error
            console.log(err)
          }
          blocklist = list
          server.listen(3000)
        })
      })
    }
  })
}
