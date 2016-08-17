'use strict'

const shell = require('shelljs')
const fs = require('fs')
const split = require('split')
const vfs = require('vinyl-fs')
const IPSet = require('ip-set')
const Netmask = require('netmask').Netmask
const path = require('path')

const REPO_URL = 'https://github.com/firehol/blocklist-ipsets.git'
const REPO_DIR = path.resolve(__dirname, '../blocklist-ipsets')
const FULL_LIST = process.env.FULL_LIST || false

if (FULL_LIST) {
  console.log('Loading full list...')
}

/**
 * Used to bootstrap the entire process, from fetching to loading
 * for testing purposes
 * @return {IPSet} list - Blocklist Ipsets
 */
function main () {
  return new Promise((resolve, reject) => {
    fetch(REPO_DIR, true).then(() => {
      return load(REPO_DIR)
    }).then(result => {
      resolve(result)
    }).catch(err => {
      reject(err)
    })
  })
}

/**
 * Fetch list from GitHub Repository [https://github.com/firehol/blocklist-ipsets.git]
 * @param  {String} dir - List directory
 */
function fetch (dir, silent) {
  return new Promise((resolve, reject) => {
    if (!dir) reject()
    function handler(code, stdout, error) {
      if (code == -1) {
        reject()
      } else {
        resolve()
      }
    }
    fs.stat(dir, (error, stat) => {
      if (error) {
        shell.exec(`git clone ${REPO_URL} --branch master --single-branch`, {silent:silent}, handler)
      } else {
        shell.exec(`cd ${REPO_DIR} && git pull origin master`, {silent: silent}, handler)
      }
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
    // Fetch the new list of items as a stream
    // TODO: Switch to glob module
    // TODO: Create flag, add all lists or one list
    let fileStream = vfs.src([`${dir}/**/*.ipset`, `${dir}/**/*.netset`], {
      buffer: false
    })
    fileStream.on('data', function (file) {
      fileStream.pause()
      if (FULL_LIST) {
        file.pipe(split())
          .on('data', (line) => {
            let strippedLine = line.trim()
            if (strippedLine && !line.startsWith('#')) {
              list.add(_sanitizeIP(strippedLine))
            }
          })
          .on('error', err => {
            reject(err)
          })
          .on('end', () => {
            fileStream.resume()
          })
      } else if (/firehol_level/.test(file.path)) {
        file.pipe(split())
          .on('data', (line) => {
            let strippedLine = line.trim()
            if (strippedLine && !line.startsWith('#')) {
              list.add(_sanitizeIP(strippedLine))
            }
          })
          .on('error', err => {
            reject(err)
          })
          .on('end', () => {
            fileStream.resume()
          })
      } else {
        fileStream.resume()
      }
    })
    .on('error', err => {
      reject(error)
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
function _sanitizeIP (line) {
  let RE_CIDR = /^\s*(?:[^#].*?\s*:\s*)?([0-9.:]+)\/([0-9]{1,2})\s*$/
  let match = RE_CIDR.exec(line)
  if (match) {
    let range = new Netmask(match[1] + '/' + match[2])
    return {start: range.first, end: range.broadcast || range.last}
  } else {
    return line
  }
}

exports.main = main
exports.fetch = fetch
exports.load = load
exports._sanitizeIP = _sanitizeIP
