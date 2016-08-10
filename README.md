# wicked.haufe.io

This repository contains the integration testing code for the API Portal docker containers.

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
