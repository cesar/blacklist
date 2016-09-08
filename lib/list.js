'use strict'

const Git = require('nodegit')
const split = require('split')
const vfs = require('vinyl-fs')
const IPSet = require('ip-set')
const Netmask = require('netmask').Netmask
const path = require('path')

/**
 * Fetch list from GitHub Repository [https://github.com/firehol/blocklist-ipsets.git]
 * @param  {String} dir - List directory
 */
function fetch (dir) {
  return new Promise((resolve, reject) => {
    Git.Repository.open(dir).then(repo => {
      return repo.fetch('origin')
    }).then((stuff) => {
      resolve()
    }).catch(err => {
      console.trace(err)
      reject(err)
    })
  })
}

/**
 * Scan the list directory and load the IPs into memory
 * @param  {Function} cb
 */
function load (dir) {
  return new Promise((resolve, reject) => {
    let list = new IPSet()
    let fileStream = vfs.src(['firehol*.@(ipset|netset)'], {buffer: false})
    // @TODO: implement transform stream
    fileStream.on('data', function (file) {
      fileStream.pause()
      file.pipe(split())
        .on('data', (line) => {
          if (line.trim() && !line.startsWith('#')) {
            list.add(sanitize(line.trim()))
          }
        })
        .on('error', err => {
          reject(err)
        })
        .on('end', () => {
          fileStream.resume()
        })
    })
      .on('error', err => {
        reject(err)
      })
      .on('end', () => {
        resolve(list)
      })
  })
}

/**
 * Determine if and how the line should be inserted into
 * the IPSet blocklist, it line contains a regular IP
 * address, it's trimmed and returned, if line contains a
 * CIDR address, create netmask range object
 * @param  {String} line Current line
 * @return {Object}     Object to be inserted into the blocklist
 */
function sanitize (line) {
  let RE_CIDR = /^\s*(?:[^#].*?\s*:\s*)?([0-9.:]+)\/([0-9]{1,2})\s*$/
  let match = RE_CIDR.exec(line)
  if (match) {
    let range = new Netmask(match[1] + '/' + match[2])
    return {start: range.first, end: range.broadcast || range.last}
  } else {
    return line
  }
}

exports.fetch = fetch
exports.load = load
exports.sanitize = sanitize
