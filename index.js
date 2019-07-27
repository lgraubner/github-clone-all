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

let done = 0

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
                              name
                              url
                              isFork
                          }
                      }
                  }
              }
              organization(login: "${options.username}") {
                  repositories(first: 100) {
                      edges {
                          node {
                              name
                              url
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

function download(repository, dest, spinner, callback) {
  const { url, name } = repository

  const filePath = path.resolve(dest, `${name}.tar.gz`)

  const exists = fs.existsSync(filePath)

  if (!exists) {
    const curl = `curl -H "Authorization: token ${
      options['access-token']
    }" -L ${url}/tarball/master > ${filePath}`

    exec(curl, function(err) {
      if (err) {
        throw err
      }

      callback(null)
    })
  } else {
    callback(null)
  }

  done++
}

fetchRepositories().then(res => {
  if (res.data.data && Object.keys(res.data.data).length != 0) {
    const repos = (res.data.data.user || res.data.data.organization)
      .repositories.edges

    let dest = './'
    if (options._.length) {
      // eslint-disable-next-line
      dest = options._[0]
    }

    const destFolder = path.resolve(dest)

    // create target folder if not exists
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder)
    }

    const spinner = ora(`Downloading archives...`).start()

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

        spinner.text = `Downloading archives... (${done}/${
          repos.length
        }) ${chalk.dim(node.name)}`

        download(node, dest, spinner, callback)
      },
      () => {
        spinner.succeed(
          `Downloaded repositories for Github user ${
            options.username
          } to "${path.resolve(dest)}".`
        )
        process.exit()
      }
    )
    return
  }
  if (res.data.errors && res.data.errors.length) {
    res.data.errors.map(e => e.message).map(console.error)
    return
  }
})
