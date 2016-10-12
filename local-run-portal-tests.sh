#!/bin/bash

export DOCKER_PREFIX=local_
export DOCKER_TAG=dev

set -e

rm -f docker-portal.log
thisPath=`pwd`

echo Docker logs go into docker-portal.log.

pushd ../wicked.portal-env
echo Building Environment docker image...
docker build -t ${DOCKER_PREFIX}portal-env:${DOCKER_TAG}-onbuild . >> $thisPath/docker-portal.log 
popd

pushd ../wicked.portal-api
echo Building API docker image...
perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' Dockerfile.template > Dockerfile
docker build -t ${DOCKER_PREFIX}portal-api:${DOCKER_TAG} . >> $thisPath/docker-portal.log
popd

pushd ../wicked.portal
echo Building Portal docker image...
perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' Dockerfile.template > Dockerfile
docker build -t ${DOCKER_PREFIX}portal:${DOCKER_TAG} . >> $thisPath/docker-portal.log
popd

perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' base/Dockerfile.template > base/Dockerfile
perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' local-compose-portal.yml.template > local-compose-portal.yml

echo Building Test containers...
docker-compose -f local-compose-portal.yml build >> $thisPath/docker-portal.log
echo Running Portal test containers...
docker-compose -f local-compose-portal.yml up > portal-test.log
echo Copying test results...
docker cp wickedportaltest_portal-test-data_1:/usr/src/app/test_results .
echo Taking down Test containers...
docker-compose -f local-compose-portal.yml down >> $thisPath/docker-portal.log

cat test_results/portal-test.log

echo Detailed logs are in portal-test.log.

echo Done.
