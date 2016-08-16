'use strict'

//  TODO: Configure startup script using `npm start`
//  TODO: Add HTTPS support, although is it needed?
//  TODO: Configure pm2 to restart servers automagically, can PM@ be isntalled as a dev dependancy
//  TODO: Kill server after X amount of time, server kill will not happen simultaneously

const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const multer = require('multer')
const upload = multer()
const startup = require('./scripts/startup')
let blocklist

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.post('/check', upload.array(), function (req, res) {
  //TODO: check whether address is an actual IP
  console.log(req.body)
  console.log(blocklist)
  let result = blocklist.contains(req.body.address.trim())
  res.json({
    contains: result
  })
})


startup(function(err, list) {
  if (err) {
    console.log(err)
  }
  blocklist = list
  let server = app.listen(3000, function () {
    console.log('Server up')
  })

  // After a while, the server becomes useless, take it down
  // setTimeout(function(){
  //   server.close()
  // }, 10000)
})
