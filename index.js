'use strict'

//  TODO: Configure startup script using `npm start`
//  TODO: Add HTTPS support, although is it needed?

const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const multer = require('multer')
const upload = multer()
const list = require('./lib/list')
const path = require('path')

const cluster = require('cluster');
const http = require('http');
let listPath = path.join(__dirname, 'blocklist-ipsets')
const REFRESH_PERIOD = 1000 * 60 * 12

if (cluster.isMaster) {
  //Bootstrap - clone or pull the repo
  list.fetch(listPath)
  //Start workers and listen for messages containing notifyRequest
  const cores = require('os').cpus().length
  let workers = []
  for (var i = 0; i < cores; i++) {
    workers.push(cluster.fork())
  }
  // Update the repo and notify the processes
  setInterval(function(){
    startup.fetchList(listPath)
    for(let id in cluster.workers) {
      // Don't refresh them all at once
      setTimeout(() => {
        cluster.workers[id].send('refresh')
      }, 10000)
    }
  }, REFRESH_PERIOD) // Every 12 mins


} else {
  let blocklist
  // Bootstrap
  list.load(function(err, list){
    blocklist = list
    app.listen(3000, function () {
      console.log('Server up on worker: ' + cluster.worker.id)
    })
  })

  // parse application/x-www-form-urlencoded
  app.use(bodyParser.urlencoded({ extended: false }))

  // parse application/json
  app.use(bodyParser.json())

  app.post('/check', upload.array(), function (req, res) {
    //TODO: check whether address is an actual IP (needed?)
    let result = blocklist.contains(req.body.address.trim())
    res.json({
      contains: result
    })
  })

  // refresh and swap
  process.on('message', (msg) => {
    if (msg === 'refresh') {
      list.load((err, list) => {
        if (err) {
          // TODO: Handle Error
          console.log(err)
        }
        blocklist = list
      })
    }
  })

}
