#!/bin/bash

export DOCKER_PREFIX=local_
export DOCKER_TAG=dev
export WICKED_KONG_IMAGE=kong:latest

set -e

rm -f docker-kong-adapter.log
thisPath=`pwd`

echo Docker logs go into docker-kong-adapter.log.

pushd ../wicked.portal-env

echo Building Environment docker image...
docker build -t ${DOCKER_PREFIX}portal-env:${DOCKER_TAG}-onbuild . >> $thisPath/docker-kong-adapter.log 
popd

pushd ../wicked.portal-api
echo Building API docker image...

perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' Dockerfile.template > Dockerfile
docker build -t ${DOCKER_PREFIX}portal-api:${DOCKER_TAG} . >> $thisPath/docker-kong-adapter.log
popd

pushd ../wicked.portal-kong-adapter
echo Building Kong Adapter docker image...

perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' Dockerfile.template > Dockerfile
docker build -t ${DOCKER_PREFIX}portal-kong-adapter:${DOCKER_TAG} . >> $thisPath/docker-kong-adapter.log
popd

pushd ../wicked.kong
echo Building Kong docker image...

perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' Dockerfile.template > Dockerfile
docker build -t ${DOCKER_PREFIX}kong:${DOCKER_TAG} . >> $thisPath/docker-kong-adapter.log
popd

perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' base/Dockerfile.template > base/Dockerfile
perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' local-compose-kong-adapter.yml.template > local-compose-kong-adapter.yml

echo Building Test containers...
pushd base
docker build -t wickedportaltest_test-base . >> $thisPath/docker-kong-adapter.log
popd

docker-compose -f local-compose-kong-adapter.yml build >> $thisPath/docker-kong-adapter.log
echo Running Kong Adapter test containers...
docker-compose -f local-compose-kong-adapter.yml up --abort-on-container-exit > kong-test.log
echo Copying test results...
docker cp wickedportaltest_kong-adapter-test-data_1:/usr/src/app/test_results .
echo Copying Kong logs
mkdir -p test_results/kong_logs
docker cp wickedportaltest_kong_1:/usr/local/kong/logs/error.log test_results/kong_logs 
docker cp wickedportaltest_kong_1:/usr/local/kong/logs/access.log test_results/kong_logs 
docker cp wickedportaltest_kong_1:/usr/local/kong/logs/serf.log test_results/kong_logs 

echo Taking down Test containers...
docker-compose -f local-compose-kong-adapter.yml down >> $thisPath/docker-kong-adapter.log

cat test_results/kong-test.log

echo Detailed logs are in kong-test.log.

echo Done.
