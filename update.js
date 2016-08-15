'use strict'
const vfs = require('vinyl-fs')
const redis = require('redis')
const client = redis.createClient()
const Git = require('nodegit')
const path = require('path')
const fs = require('fs')

// Redis Keys
const OLD_SET = 'old:ipsets:set'
const NEW_SET = 'new:ipsets:set'
const CURRENT_SET = 'current:ipsets:set'


// var fileStream = vfs.src(['./list/blocklist-ipsets/**/*.ipset', './list/blocklist-ipsets/**/*.netset'], {
//   buffer: false
// })

// fileStream.on('data', function (file) {
//   fileStream.pause()
//   file.contents.setEncoding('utf8')
//   file.contents.on('data', function (data) {
//     file.contents.pause()
//     // Remove the ips
//     let ips = data.split('\n').filter(function (item) {
//       return !item.startsWith('#') && item.trim()
//     })
//     if (ips.length > 0) {
//       client.sadd('ipset:queue', ips, function (err, replies) {
//         if (err) {
//           console.log(err)
//         }
//         file.contents.resume()
//       })
//     } else {
//       file.contents.resume()
//     }
//   })

//   file.contents.on('end', function () {
//     client.scard('ipset:queue', function (err, replies) {
//       if (err) {
//         console.log(err)
//       }
//       console.log(replies)
//       client.quit()
//     })
//   })
// })

/**
 * Update the ipsets list
 */
function refreshIpsets () {
  // @TODO - Add progress bar to the status
  let listPath = path.join(__dirname, 'list')
  fs.stat(listPath, (err, stats) => {
    if (err) {
      // No such directory
      return _cloneRepo(listPath)
    } else {
      // Directory exists
      return _pullRepo(listPath)
    }
  })
}

/**
 * Clone the repo locally
 * @param {String} dir - path to directoy where repo will reside
 */
function _cloneRepo (dir) {
  let cloneURL = 'https://github.com/firehol/blocklist-ipsets.git'
  let cloneOptions = {
    fetchOpts: {
      callbacks: {
        certificateCheck: function () { return 1 } // This should only be done in OSX
      }
    },
    checkoutBranch: 'master'
  }
  return Git.Clone(cloneURL, dir, cloneOptions)
}

/**
 * Update the ipset list to the latest version
 * @param {String} dir - path to the repository
 */
function _pullRepo (dir) {
  let repo
  return Git.Repository.open(dir)
    .then(repository => {
      console.log('fetching repo')
      repo = repository
      return repo.fetch('origin', {
        callbacks: {
          certificateCheck: () => { return 1 }, // OSX specific
          transferProgress: (stuff) => {
            console.log(stuff)
          }
        }
      })
    }).then(() => {
      // Repo has been fetched
      return repo.mergeBranches('master', 'origin/master')
    })
}

/**
 * Remove the previous ipset list
 */
function removeOldIpsets () {
  return new Promise((resolve, reject) => {
    client.del(OLD_SET, (err, reply) => {
      if (err) {
        reject(err)
      }
      resolve(reply)
    })
  })
}

/**
 * Fetch all of the files in the ipset-blocklist
 * and add the ipsets to redis
 */
function addNewIpsets () {
  return new Promise((resolve, reject) => {
    // Fetch the new list of items
    let fileStream = vfs.src(['./list/**/*.ipset', './list/**/*.netset'], {
      buffer: false
    })

    fileStream.on('data', function (file) {
      fileStream.pause()
      file.contents.setEncoding('utf8')
      file.contents.on('data', function (data) {
        file.contents.pause()
        // Fetch the actual IPs
        let ips
        if (Buffer.isBuffer(data)) {
          ips = data.toString('utf8').split('\n').filter(function (item) {
            return !item.startsWith('#') && item.trim()
          })
          file.contents.resume()
        } else {
          ips = data.split('\n').filter(function (item) {
            return !item.startsWith('#') && item.trim()
          })
          if (ips.length > 0) {
            client.sadd(NEW_SET, ips, function (err, replies) {
              if (err) {
                reject(err)
              }
              file.contents.resume()
            })
          } else {
            file.contents.resume()
          }
        }
      })

      file.contents.on('error', (err) => {
        reject(err)
      })

      file.contents.on('end', function () {
        fileStream.resume()
      })
    })

    fileStream.on('error', err => {
      reject(err)
    })

    fileStream.on('end', () => {
      resolve()
    })
  })
}

// function swapIpsets () {

// }

// function main () {

// }

addNewIpsets().then(result => {
  console.log('Success')
  client.quit()
}).catch(err => {
  console.log(err)
  client.quit()
})

