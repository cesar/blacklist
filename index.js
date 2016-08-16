'use strict'

//  TODO: Configure startup script using `npm start`
//  TODO: Add HTTPS support, although is it needed?
//  TODO: Configure pm2 to restart servers automagically, can PM@ be isntalled as a dev dependancy
//  TODO: Kill server after X amount of time, server kill will not happen simultaneously

const express = require('express')
const app = express()
const shell = require('shelljs')
const path = require('path')
const fs = require('fs')
const split = require('split')
const vfs = require('vinyl-fs')
const IPSet = require('ip-set')
const bodyParser = require('body-parser')
const multer = require('multer')
const upload = multer()
const Netmask = require('netmask').Netmask
let blocklist = new IPSet()


// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.post('/check', upload.array(), function (req, res) {
  //TODO: check whether address is an actual IP
  console.log(req.body)
  let result = blocklist.contains(req.body.address.trim())
  res.json({
    contains: result
  })
})

// Check if repo exists, fetch/clone sync
let listPath = path.join(__dirname, 'blocklist-ipsets')

// TODO: handle errors
fs.stat(listPath, (err, stats) => {
  if (err) {
    // TODO: Output to stdout, to see progress
    shell.exec('git clone https://github.com/firehol/blocklist-ipsets.git --branch master --single-branch')
  } else {
    // Directory exists, refresh origin
    shell.exec('cd blocklist-ipsets/ && git pull origin master')
  }
  // Fetch the new list of items as a stream
  let fileStream = vfs.src(['./blocklist-ipsets/**/*.ipset', './blocklist-ipsets/**/*.netset'], {
    buffer: false
  })

  fileStream.on('data', function (file) {
    fileStream.pause()
    file.pipe(split()).on('data', (line) => {
      let strippedLine = line.trim()
      if (strippedLine && !line.startsWith('#')) {
        // TODO: Need to check for CIDR
        let RE_CIDR = /^\s*(?:[^#].*?\s*:\s*)?([0-9.:]+)\/([0-9]{1,2})\s*$/
        let match = RE_CIDR.exec(strippedLine)
        if (match) {
          console.log('CIDR')
          let range = new Netmask(match[1] + '/' + match[2])
          blocklist.add({start: range.first, end: range.broadcast || range.last})
        } else {
          blocklist.add(strippedLine)
        }
      }
    })
    .on('error', err => {
      console.log(err)
    })
    .on('end', () => {
      fileStream.resume()
    })
  })

  fileStream.on('error', err => {
    console.log(err)
  })

  fileStream.on('end', () => {
    console.log('done')
    // TODO: Add https
    app.listen(3000, function () {
      console.log('Server up')
    })
  })
})
