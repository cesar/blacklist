'use strict'

const shell = require('shelljs')
const path = require('path')
const fs = require('fs')
const split = require('split')
const vfs = require('vinyl-fs')
const IPSet = require('ip-set')
const Netmask = require('netmask').Netmask

const REPO_URL = 'https://github.com/firehol/blocklist-ipsets.git'
const REPO_DIR = 'blocklist-ipsets/'

/**
 * Fetch list from GitHub Repository [https://github.com/firehol/blocklist-ipsets.git]
 * @param  {String} dir - List directory
 * @param  {Function} cb
 */
function fetch (dir) {
  // TODO: handle errors
  try {
    fs.statSync(dir)
    shell.exec(`cd ${REPO_DIR} && git pull origin master`)
  } catch (e) {
    shell.exec(`git clone ${REPO_URL} --branch master --single-branch`)
  }
}

/**
 * Scan the list directory and load the IPs into memory
 * @param  {Function} cb
 */
function load (cb) {
  let list = []
  // Fetch the new list of items as a stream
  let fileStream = vfs.src(['./blocklist-ipsets/**/*.ipset', './blocklist-ipsets/**/*.netset'], {
    buffer: false
  })
  fileStream.on('data', function (file) {
    fileStream.pause()
    if (/firehol_level/.test(file.path)) {
      file.pipe(split()).on('data', (line) => {
        let strippedLine = line.trim()
        if (strippedLine && !line.startsWith('#')) {
          list.push(_sanitizeIP(strippedLine))
        }
      })
      .on('error', err => {
        cb(err)
      })
      .on('end', () => {
        fileStream.resume()
      })
    } else {
      fileStream.resume()
    }
  })
  fileStream.on('error', err => {
    cb(err)
  })
  fileStream.on('end', () => {
    cb(null, new IPSet(list))
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
function _sanitizeIP(line) {
  // TODO: Need to check for CIDR
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
