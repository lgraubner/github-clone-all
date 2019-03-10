#!/usr/bin/env node

const mri = require('mri')
const axios = require('axios')
const { exec } = require('child_process')
const ora = require('ora')
const path = require('path')
const eachLimit = require('async/eachLimit')
const chalk = require('chalk')
const fs = require('fs')
const pkg = require('./package.json')

const args = process.argv.slice(2)

const options = mri(args, {
  default: {
    'ignore-forks': false,
    ignore: '',
    'max-concurrency': 5
  }
})

if (options.help) {
  console.log(`
  Usage: github-clone-all [options] [destination]


  Options:

    --help                    output usage information
    --version                 output the version number
    --access-token <token>    personal github access token (required)
    --username <user>         Github username (required)
    --ignore-forks            ignore forked repositories
    --ignore <repos>          comma seperated list of repositories to ignore
    --max-concurrency <num>   max concurrent clone processes (default: 5)
  `)
  process.exit()
}

if (options.version) {
  console.log(pkg.version)
  process.exit()
}

if (!options['access-token']) {
  throw new Error('Github access token is required!')
}

if (!options.username) {
  throw new Error('Github username is required')
}

const ignoredRepos = options.ignore.split(',')

function fetchRepositories() {
  return axios({
    url: 'https://api.github.com/graphql',
    method: 'post',
    headers: {
      Authorization: `bearer ${options['access-token']}`
    },
    data: {
      query: `
          query {
              user(login: "${options.username}") {
                  repositories(first: 100) {
                      edges {
                          node {
                              name,
                              url,
                              isFork
                          }
                      }
                  }
              }
          }
          `
    }
  })
}

function clone(repo, dest, spinner, callback) {
  const { name, url } = repo

  const destFolder = path.resolve(dest, name)

  fs.access(destFolder, accessErr => {
    // folder does not exist
    if (accessErr) {
      exec(`git clone ${url}.git ${destFolder}`, err => {
        if (err) {
          ora().fail(name)
        } else {
          ora().succeed(name)
        }

        callback(null)
      })
    } else {
      ora().succeed(`${name} ${chalk.dim('(exists)')}`)
      callback(null)
    }
  })
}

fetchRepositories().then(res => {
  if (res.data.data !== null) {
    const repos = res.data.data.user.repositories.edges

    let dest = './'
    if (options._.length) {
      // eslint-disable-next-line
      dest = options._[0]
    }

    const spinner = ora(`Cloning repositories...`).start()

    eachLimit(
      repos,
      options['max-concurrency'],
      (repo, callback) => {
        const { name, isFork, node } = repo
        if (
          ignoredRepos.indexOf(name) !== -1 ||
          (options['ignore-forks'] && isFork)
        ) {
          callback(null)
          return
        }

        clone(node, dest, spinner, callback)
      },
      () => {
        spinner.clear()
        process.exit()
      }
    )
  }
})
