# wicked.haufe.io

This repository contains the integration testing code for the API Portal docker containers.

### Preparing `Dockerfile` for testing base image

Depending on your build setup, you may want to choose different base images for your testing scenarios. The `Dockerfile` in the `base` directory is a template in which the `FROM` statement is templated with an environment variable. This is unfortunately not supported by docker, so that you need to do a search and replace yourself, e.g. using a `perl` statement like the following:

```
$ export DOCKER_PREFIX=haufelexware/wicked.
$ perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' base/Dockerfile.template > base/Dockerfile
```

These two commands will create a `Dockerfile` which uses the official base image for testing. If you have your own builds, you may replace it with something else here.

### Testing `portal-api`

To run the integration tests of the `haufelexware/wicked.portal-api:dev` container, do this:

```
$ docker-compose -f docker-compose.portal-api.yml build
$ docker-compose -f docker-compose.portal-api.yml up > api-test.log
$ docker cp wickedportaltest_api-test-data_1:/usr/src/app/test_results .
```

### Testing `portal`

To run the integration tests of the `haufelexware/wicked.portal-api:dev` container, do this:

```
$ docker-compose -f docker-compose.portal.yml build
$ docker-compose -f docker-compose.portal.yml up > portal-test.log
$ docker cp wickedportaltest_portal-test-data_1:/usr/src/app/test_results .
```

### Seeing test results

The test results can be seen in the `test_results` folder after copying them to your local host via `docker cp` (the last command above).

### Technical Things

A set of environment variables specific to the test cases are referenced via the `variables.env` file inside the `docker-compose.*.yml` configuration files. Both test suites (API and Portal) make use of different instances of test data (as of writing these are identical, but do not have to be in the future), stored as `test-config` inside the sub directories. 

### TODOs

The tests are created as integration tests, which makes calculating code coverage impossible. The point with these tests is that the actual docker images which are used for production are tested in a real scenario (deployment via `docker-compose`). If you wanted to calculate code coverage of the integration tests, you would have to instrument the images with e.g. `istanbul`, but you would not want to have that in your production images.

A possible way of circumventing this would be to have special testing containers which allow instrumenting the containers with `istanbul` in addition to the "real" images for production use. You could then run both kinds of tests: First the integration tests on the production containers, then an instrumented test on the testing containers. Other ideas are welcome as well. 

## Running the tests locally

It's also possibly to run the tests on your local docker host. The only prerequisite is that you have aligned your `wicked` repositories alongside of each other.

```
wicked
  |
  +-- wicked.portal
  |
  +-- wicked.portal-api
  |
  +-- wicked.portal-test
  |
     ...
```

You may then use the bash scripts `local-run-api-tests.sh` (for the API integration tests) and `local-run-portal-tests.sh` (for the portal integration tests).

Once the base images have been built, it should be fairly fast to run the tests (around 20 seconds per run).