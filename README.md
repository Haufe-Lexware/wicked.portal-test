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
