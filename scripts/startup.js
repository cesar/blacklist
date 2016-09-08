#!/bin/bash

/// @TODO: Rewrite as bash script

const shell = require('shelljs')
const path = require('path')

if (!shell.which('git')) {
  shell.echo('No git found, installing...')
  shell.exec('apt-get update && apt-get install git')
}

shell.cd(path.resolve(__dirname, '../'))

shell.mkdir('blocklist-ipsets')

shell.cd('blocklist-ipsets')

shell.exec('git clone https://github.com/firehol/blocklist-ipsets.git --branch master --single-branch .')

shell.echo('List added succesfully')

shell.exit(0)
