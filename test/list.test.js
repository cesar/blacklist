'use strict'

const list = require('../lib/list')
const path = require('path')
const test = require('ava')
const listPath = path.resolve(__dirname, '../blocklist-ipsets')
const testList = path.join(__dirname, '/test-list')
const IPSet = require('ip-set')

test('testing list fetch should fail, no directory provided', t => {
  t.plan(1)
  return list.fetch().catch(() => {
    t.pass()
  })
})

test('testing list fetch, promise should resolve', t => {
  t.plan(1)
  return list.fetch(listPath, true).then(() => {
    t.pass()
  })
})

test('testing loading of the list', t => {
  t.plan(2)
  return list.load(listPath).then(result => {
    t.truthy(result.add instanceof Function)
    t.truthy(result.contains instanceof Function)
  })
})

/**
 * Test IPs
 * 1.93.0.224
 * 5.14.88.213
 * 5.15.43.105
 *
 * 1.55.97.1
 * 1.20.151.100
 * 1.20.151.255
 */

test('test list IPs agains known blocked IP sets', t => {
  t.plan(6)
  return list.load(testList).then(result => {
    t.truthy(result.contains('1.93.0.224'))
    t.truthy(result.contains('5.14.88.213'))
    t.truthy(result.contains('5.15.43.105'))
    t.truthy(result.contains('1.55.97.1'))
    t.truthy(result.contains('1.20.151.100'))
    t.truthy(result.contains('1.20.151.255'))
  })
})

test('test against popular IPs such as Google, Github, and Facebook', t => {
  t.plan(3)
  return list.load(testList).then(result => {
    t.falsy(result.contains('8.8.8.8'))
    t.falsy(result.contains('8.8.4.4'))
    t.falsy(result.contains('192.30.252.1'))
  })
})

test('testing ip line sanitation, should return range in case of CIDR notation', t => {
  t.plan(2)
  let line = list._sanitizeIP('1.93.0.224')
  t.is(line, '1.93.0.224')

  line = list._sanitizeIP('1.10.16.0/20')
  t.deepEqual(line, {start: '1.10.16.1', end: '1.10.31.255'})
})
