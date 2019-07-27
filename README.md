# github-clone-all

[![npm](https://img.shields.io/npm/v/github-clone-all.svg)](https://www.npmjs.com/package/github-clone-all)

Clones all of your Github repositories, including private repositories. Currently limited to 100 repositories (max for one request), feel free to send a PR to support more.

## Table of contents

- [Install](#install)
- [Usage](#usage)
- [Options](#options)
- [License](#license)

## Install

This module is available on [npm](https://www.npmjs.com/).

```BASH
$ npm install -g github-clone-all
```

This package requires `curl` to run on your system!

## Usage

An access token and an username are required. All repositories will be cloned into the current working directory if not specified otherwise.

```BASH
$ github-clone-all --access-token YOUR_ACCESS_TOKEN --username USERNAME
```

## Options

```BASH
Usage: github-clone-all [options] [destination]


  Options:

    --help                    output usage information
    --version                 output the version number
    --access-token <token>    personal github access token (required)
    --username <user>         Github username (required)
    --ignore-forks            ignore forked repositories
    --ignore <repos>          comma seperated list of repositories to ignore
    --max-concurrency <num>   max concurrent clone processes (default: 5)
```

### access-token

Your Github personal access token. Can be acquired in your [Github settings](https://github.com/settings/tokens). You need at least the `repo` scope to use it with this package.

### username

Your Github username.

### ignore-forks

Ignore all forks.

### ignore

Comma seperated list of repositories to ignore.

### max-concurrency

By default up to five repositories will be cloned concurrently. Can be adjusted it with this option.

## License

[MIT](https://github.com/lgraubner/github-clone-all/blob/master/LICENSE) © [Lars Graubner](https://larsgraubner.com)
