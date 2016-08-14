'use strict'

const fs = require('fs')
const path = require('path')
const redis = require('redis')
const client = redis.createClient()

function readFiles (dir) {
  try {
    let files = fs.readdirSync(dir, 'utf8')
    files.forEach((file) => {
      // Check to see if it's a directory
      if (fs.statSync(path.join(dir, file)).isDirectory()) {
        readFiles(path.join(dir, file))
      } else {
        fs.createReadStream(path.join(dir, file))
        let fileContent = fs.readFileSync(path.join(dir, file), 'utf8')
        fileContent.split('\n').filter((line) => {
          return !line.startsWith('#') && line.trim()
        }).forEach((item) => {
          client.sadd('iplist:cache', item.trim())
        })
        // Free up memory
        fileContent = null
        return
      }
    })
  } catch (e) {
    console.log(e)
    throw e
  }
}

readFiles('list')
console.log(client.scard('iplist:cache'))


