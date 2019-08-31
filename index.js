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

function logError(...messages) {
  console.error(`${chalk.red('Error!')} ${messages.join('\n')}`)
}

function help() {
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
}

function fetchRepositories(username, accessToken) {
  return axios({
    url: 'https://api.github.com/graphql',
    method: 'post',
    headers: {
      Authorization: `bearer ${accessToken}`
    },
    data: {
      query: `
          query {
              user(login: "${username}") {
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
              organization(login: "${username}") {
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

function download(repository, accessToken, dest, spinner, callback) {
  const { url, name } = repository

  const filePath = path.resolve(dest, `${name}.tar.gz`)

  const exists = fs.existsSync(filePath)

  if (!exists) {
    const curl = `curl -H "Authorization: token ${accessToken}" -L ${url}/tarball/master > ${filePath}`

    exec(curl, function(err) {
      if (err) {
        throw err
      }

      callback(null)
    })
  } else {
    callback(null)
  }
}

async function main(argv_) {
  const args = argv_.slice(2)

  const options = mri(args, {
    default: {
      'ignore-forks': false,
      ignore: '',
      'max-concurrency': 5
    }
  })

  if (options.help) {
    help()
    process.exit()
  }

  if (options.version) {
    console.log(pkg.version)
    process.exit()
  }

  if (!options['access-token']) {
    logError(
      'A Github access token is required.',
      'Please go to https://github.com/settings/tokens/new and issue a token with all repo scopes enabled.'
    )

    return 1
  }

  if (!options.username) {
    logError('Please provide a Github username.')

    return 1
  }

  const ignoredRepos = options.ignore.split(',')

  let done = 0

  try {
    const res = await fetchRepositories(
      options.username,
      options['access-token']
    )

    if (res.data.data && Object.keys(res.data.data).length != 0) {
      const userOrOrg = res.data.data.user || res.data.data.organization

      if (userOrOrg === null) {
        logError('User or organisation not found.')
        return 1
      }

      const repos = userOrOrg.repositories.edges

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
      const repoCount = repos.reduce((count, repo) => {
        if (options['ignore-forks'] && repo.node.isFork) {
          return count
        }

        count++

        return count
      }, 0)

      eachLimit(
        repos,
        options['max-concurrency'],
        (repo, callback) => {
          const { name, isFork } = repo.node
          if (
            ignoredRepos.indexOf(name) !== -1 ||
            (options['ignore-forks'] && isFork)
          ) {
            callback(null)
            return
          }

          spinner.text = `Downloading archives... (${done}/${repoCount}) ${chalk.dim(
            name
          )}`

          download(repo.node, options['access-token'], dest, spinner, () => {
            done++
            callback()
          })
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
  } catch (err) {
    console.log(err)
    if (err.response.status === 401) {
      logError(
        'Your access token is invalid',
        'Please go to https://github.com/settings/tokens/new and issue a token with all repo scopes enabled.'
      )
    } else {
      throw err
    }
  }
}

main(process.argv)
