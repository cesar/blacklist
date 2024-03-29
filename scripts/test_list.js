'use strict'

let list = require('../lib/list')
const Chance = require('chance')
const chance = new Chance()
const total = 1000000

/**
 * Test random IPs to see hit/miss ratio
 * @type {[type]}
 */
list.main().then(list => {
  let count = 0
  for (var i = 0; i < total; i++) {
    if (list.contains(chance.ip())) {
      count++
    }
  }
  console.log('Tests done:')
  console.log('Hits: ' + count)
  console.log('Misses: ' + (total - count))
  console.log('Percentage: ' + (count / total) * 100 + '%')
}).catch(err => {
  console.log(err)
})
