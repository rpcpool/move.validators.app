# Move validators javascript

The js files contained in this folder are what pulls data via the Aptos SDK and drops all of it into Redis.
Once the jobs are added to Redis, the JobDispatcher side will run its jobs to process and save the data for display.

Environmental properties are used via `dotenv`, but are encrypted and managed via the `dotenvenc` package. Scripts are provided to bootstrap and manage these per environment (via NODE_ENV var) like Rails credentials. 

[pnpm](https://pnpm.io) is the preferred package manager.

The code is split off into various folders:

```
js/
├── bin
├── daemons
├── lib
│   ├── queue
│   └── test
└── test
    ├── daemons
    └── lib
```

## `bin`

The `bin` folder contains the main entry points to bootstrap the environment and edit the credentials/env vars.

`bootstrap.sh` will look for the `.env_pass` file, which exports the `DOTENVENC_PASS` for `dotenvenc` to use. The `bootstrap.sh` script must be used when running all js files, including tests, in this folder. This will correctly setup the environment so dotenv can use the values where needed.

`edit-env.sh` provides `Rails credentials:edit` functionality, via `pnpm credentials:edit`, so key/values can be managed for use.

## `daemons`

The `daemons` folder contains all the daemons that run on the deployed servers. These are all broken up into thei respective functions like fetching a list of validators, fetching and processing various specific metrics, etc. The goal for each one is to balance very specific data gathering vs. general data gathering and processing. 

## `lib`

The `lib` folder contains all the code that is shared between the daemons and the tests. The `queue` folder contains utilities and helpers that deal with working with Redis/JobDispatcher. The `test` folders contains files and utilities that run all the test files.

## `test`

The `test` folder contains all the daemon and lib test files. A simpled testing framework was built to mimic basic Rails Minitest structure and provide a similar logical approach.