# wicked.haufe.io

This repository contains the integration testing code for the API Portal docker containers.

## Running the tests on locally built container images

In order to run the integration tests locally on your own machine, the following prerequisites needs to be fulfilled.

#### Repository layout

The wicked repositories need to be cloned in the following way:

```
wicked
  |
  +-- wicked.portal
  |
  +-- wicked.portal-api
  |
  +-- wicked.portal-test
  |
  +-- wicked.kong
  |
  +-- wicked.portal-kong-adapter
```

#### Docker

You will need to have a docker host available by simply invoking `docker`. Additionally, the test suite makes use of `docker-compose`, so that needs to be installed as well.

Docker is known to work with this suite as of version 1.12, Docker Compose requires to be version 1.8.0 or later.

### Running the tests

Run the integration tests by calling any of the `run-xxx-tests.sh` shell scripts in `bash` (tested on macOS and Linux, unfortunately not on Windows):

```bash
$ ./run-<api|portal|kong-adapter>-tests.sh
```

The scripts will attempt to first build the needed docker images locally (this may take some time the first time), and then runs the integration tests on the built images.

The portal tests are run with file session store by default. If you want to run them using Redis as a session store, you can do so by running them like:

```bash
$ REDIS_SESSIONS=true ./run-portal-tests.sh
```

## Running the tests on prebuilt container images

In order to run the integration tests on already prebuilt containers (e.g. the official docker images from Haufe-Lexware), use the following syntax:

```bash
$ DOCKER_PREFIX=haufelexware/wicked. DOCKER_TAG=latest ./run-<api|portal|kong-adapter>-tests.sh
```

The above line will run the integration tests for the official Haufe-Lexware wicked.haufe.io docker images, having the `latest` tag. This will require that you will have checked out the `master` branch of `wicked.portal-test`, otherwise chances are good that the test suite will not match the container images' versions.

In case your images are located on a private registry, you may also use the following environment variables:

* `DOCKER_REGISTRY`: Your private registry (e.g. `registry.haufe.io`)
* `DOCKER_REGISTRY_USER`: The registry username
* `DOCKER_REGISTRY_PASSWORD`: The registry user's password

In case `DOCKER_REGISTRY` is specified, the testing scripts will also require username and password to be set.

### Technical Things

A set of environment variables specific to the test cases are referenced via the `variables.env` file inside the `*compose.yml.template` configuration files. All test suites make use of different instances of test data, stored as `test-config` inside the sub directories. 

### TODOs

The tests are created as integration tests, which makes calculating code coverage impossible. The point with these tests is that the actual docker images which are used for production are tested in a real scenario (deployment via `docker-compose`). If you wanted to calculate code coverage of the integration tests, you would have to instrument the images with e.g. `istanbul`, but you would not want to have that in your production images.

A possible way of circumventing this would be to have special testing containers which allow instrumenting the containers with `istanbul` in addition to the "real" images for production use. You could then run both kinds of tests: First the integration tests on the production containers, then an instrumented test on the testing containers. Other ideas are welcome as well. 

