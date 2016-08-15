'use strict'

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
let blocklist = new IPSet()

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.post('/check', upload.array(), function (req, res) {
  // TODO: check whether address is an actual IP
  console.log(req.body)
  let result = blocklist.contains(req.body.address.trim())
  res.json({
    contains: result
  })
})

// Check if repo exists, fetch/clone sync
let listPath = path.join(__dirname, 'blocklist-ipsets')

fs.stat(listPath, (err, stats) => {
  if (err) {
    // No such directory
    shell.exec('git clone https://github.com/firehol/blocklist-ipsets.git --branch master --single-branch')
  } else {
    // Directory exists, refresh origin
    shell.exec('cd blocklist-ipsets/ && git pull origin master')
  }
  // Fetch the new list of items
  let fileStream = vfs.src(['./blocklist-ipsets/**/*.ipset', './blocklist-ipsets/**/*.netset'], {
    buffer: false
  })
  fileStream.on('data', function (file) {
    fileStream.pause()
    file.pipe(split()).on('data', (line) => {
      if (!line.startsWith('#') && line.trim()) {
        // Need to check for CIDR
        blocklist.add(line.trim())
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
    app.listen(3000, function () {
      console.log('Server up')
    })
  })
})

