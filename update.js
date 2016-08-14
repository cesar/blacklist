'use strict'
const vfs = require('vinyl-fs')
const redis = require('redis')
// const client = redis.createClient()
const Git = require('nodegit')
const path = require('path')
const fs = require('fs')


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

refreshIpsets().then(() => {
  console.log('repo updated')
}).catch(err => {
  console.log(err)
})

// function removeOldIpsets () {
//   return new Promise
// }

// function addNewIpsets () {

// }

// function swapIpsets () {

// }

// function main () {

// }

