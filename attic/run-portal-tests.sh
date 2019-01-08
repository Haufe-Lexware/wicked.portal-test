#!/bin/bash

set -e

buildLocal=""

if [ -z "$DOCKER_PREFIX" ]; then
    echo Env var DOCKER_PREFIX is not set, assuming local build.
    export DOCKER_PREFIX=local_
    buildLocal="yes"
fi

if [ -z "$DOCKER_TAG" ]; then
    echo Env var DOCKER_TAG is not set, assuming dev
    export DOCKER_TAG=dev
fi

if [ -z "$DOCKER_REGISTRY" ]; then
    echo DOCKER_REGISTRY is not set, assuming official Docker registry.
else
    if [ -z "$DOCKER_REGISTRY_USER" ] || [ -z "$DOCKER_REGISTRY_PASSWORD" ]; then
        echo Using custom DOCKER_REGISTRY, but either DOCKER_REGISTRY_USER or
        echo DOCKER_REGISTRY_PASSWORD is empty.
        exit 1
    fi

    echo Logging in to docker registry ${DOCKER_REGISTRY}...
    docker login -u ${DOCKER_REGISTRY_USER} -p ${DOCKER_REGISTRY_PASSWORD} ${DOCKER_REGISTRY}
fi

if [ -z "$BUILD_ALPINE" ]; then
    echo "Not building Alpine images."
    export BUILD_ALPINE=""
else 
    if [ ! "$BUILD_ALPINE" = "-alpine" ]; then
        echo "Unsupported value for BUILD_ALPINE, setting to -alpine"
        export BUILD_ALPINE="-alpine"
    fi
    echo "Building Alpine images."
fi

if [ -z "$REDIS_SESSIONS" ]; then
    echo "Not using Redis as a session store."
    export NODE_ENV="test"
else
    echo "Using Redis as a session store."
    export NODE_ENV="test-redis"
fi

rm -f logs/docker-portal${BUILD_ALPINE}.log
thisPath=`pwd`

export PORTAL_ENV_TAG=${DOCKER_TAG}-onbuild
export PORTAL_API_TAG=${DOCKER_TAG}
export PORTAL_TAG=${DOCKER_TAG}

echo Docker logs go into logs/docker-portal${BUILD_ALPINE}.log.

if [ ! -z "$buildLocal" ]; then

    echo Building images locally.

    pushd ../wicked.portal-env
    echo Building Environment docker image...
    docker build -f Dockerfile${BUILD_ALPINE} -t ${DOCKER_PREFIX}portal-env:${PORTAL_ENV_TAG}${BUILD_ALPINE} . >> $thisPath/logs/docker-portal${BUILD_ALPINE}.log 
    popd

    pushd ../wicked.portal-api
    echo Building API docker image...
    perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' Dockerfile.template > Dockerfile${BUILD_ALPINE}
    docker build -f Dockerfile${BUILD_ALPINE} -t ${DOCKER_PREFIX}portal-api:${PORTAL_API_TAG}${BUILD_ALPINE} . >> $thisPath/logs/docker-portal${BUILD_ALPINE}.log
    popd

    pushd ../wicked.portal
    echo Building Portal docker image...
    perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' Dockerfile.template > Dockerfile${BUILD_ALPINE}
    docker build -f Dockerfile${BUILD_ALPINE} -t ${DOCKER_PREFIX}portal:${PORTAL_TAG}${BUILD_ALPINE} . >> $thisPath/logs/docker-portal${BUILD_ALPINE}.log
    popd

else

    echo Using prebuilt images:
    echo DOCKER_PREFIX=$DOCKER_PREFIX
    dockerTag=${DOCKER_TAG}
    echo DOCKER_TAG=${dockerTag}

    # Magic image matching?
    if [[ "$DOCKER_PREFIX" == "haufelexware/wicked." ]]; then
        echo "INFO: Resolving image names for tag ${dockerTag}"
        docker pull haufelexware/wicked.portal-env:next-onbuild-alpine
        export PORTAL_ENV_TAG=$(docker run --rm haufelexware/wicked.portal-env:next-onbuild-alpine node node_modules/portal-env/getMatchingTag.js haufelexware wicked.portal-env ${dockerTag})
        export PORTAL_API_TAG=$(docker run --rm haufelexware/wicked.portal-env:next-onbuild-alpine node node_modules/portal-env/getMatchingTag.js haufelexware wicked.portal-api ${dockerTag})
        export PORTAL_TAG=$(docker run --rm haufelexware/wicked.portal-env:next-onbuild-alpine node node_modules/portal-env/getMatchingTag.js haufelexware wicked.portal ${dockerTag})
    fi
fi

export PROJECT_NAME=test$(od -vN "8" -An -tx1 /dev/urandom | tr -d " \n")

echo "INFO: PORTAL_ENV_TAG=${PORTAL_ENV_TAG}"
echo "INFO: PORTAL_API_TAG=${PORTAL_API_TAG}"
echo "INFO: PORTAL_TAG=${PORTAL_TAG}"
echo "INFO: PROJECT_NAME=${PROJECT_NAME}"

echo Templating Dockerfile for test base and compose file...

perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' base/Dockerfile.template > base/Dockerfile
perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' portal/Dockerfile.template > portal/Dockerfile
perl -pe 's;(\\*)(\$([a-zA-Z_][a-zA-Z_0-9]*)|\$\{([a-zA-Z_][a-zA-Z_0-9]*)\})?;substr($1,0,int(length($1)/2)).($2&&length($1)%2?$2:$ENV{$3||$4});eg' portal/portal-tests-compose.yml.template > portal/portal-tests-compose.yml

if [ -z "$buildLocal" ]; then 
    echo Using prebuilt images: Pulling images...
    docker-compose -p ${PROJECT_NAME} -f portal/portal-tests-compose.yml pull
    docker pull ${DOCKER_PREFIX}portal-env:${PORTAL_ENV_TAG}${BUILD_ALPINE}
fi

echo Building Test base container...
pushd base
docker build -t ${PROJECT_NAME}_test-base . >> $thisPath/logs/docker-portal${BUILD_ALPINE}.log
popd

echo Building Test container...
docker-compose -p ${PROJECT_NAME} -f portal/portal-tests-compose.yml build >> $thisPath/logs/docker-portal${BUILD_ALPINE}.log
echo Running Portal test containers...
failedTests=""
if ! docker-compose -p ${PROJECT_NAME} -f portal/portal-tests-compose.yml up --abort-on-container-exit > logs/portal-test${BUILD_ALPINE}.log; then
    echo WARNING: docker-compose exited with a non-zero return code.
    failedTests="true"
fi
echo Copying test results...
if [ -d test_results ]; then
    echo "INFO: Cleaning up..."
    rm -rf test_results
fi
if ! docker cp ${PROJECT_NAME}_portal-test-data_1:/usr/src/app/test_results .; then
    echo ERROR: The test results are not available.
    failedTests="true"
fi
echo Taking down Test containers...
docker-compose -p ${PROJECT_NAME} -f portal/portal-tests-compose.yml down >> $thisPath/logs/docker-portal${BUILD_ALPINE}.log

if [ ! -z "$failedTests" ]; then
    exit 1
fi

cat test_results/portal-test.log

echo Detailed logs are in logs/portal-test${BUILD_ALPINE}.log.

echo Cleaning up temporary images...
docker rmi ${PROJECT_NAME}_test-base
docker rmi ${PROJECT_NAME}_portal-test-data

if [ -f test_results/PORTAL_FAILED ]; then
    echo "ERROR: Some test cases failed."
    exit 1
fi

echo Done.
