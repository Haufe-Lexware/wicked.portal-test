#!/bin/bash

set -e

tmpDir=test-$(date +%Y%m%d%H%M%S)
mkdir -p ./tmp/$tmpDir
baseDir=$(pwd)/tmp/$tmpDir
thisDir=$(pwd)

echo "Test dir: $baseDir"

trap traperror ERR

apiPid=""

function traperror() {
    echo "*********************************"
    echo "Oh böse Welt"
    echo "*********************************"
    if [ ! -z "$apiPid" ]; then
        echo "===> Emergency killing API"
        kill $apiPid
    fi

    exit 1
}

cp -r ./portal-api/test/test-config/static ./tmp/$tmpDir/static
mkdir -p ./tmp/$tmpDir/dynamic

export PORTAL_API_HOOK_INTERVAL=250
export PORTAL_API_AESKEY=ThisIsASecretSauceKeyWhichDoesNotMatterForTheUnitTests
export PORTAL_CONFIG_KEY=ThisIsUsedInDeploy
export DEBUG=portal-api:*,portal:*,kong-adapter:*,portal-env:*
export ALLOW_KILL=true
export ALLOW_RESYNC=true
export PORTAL_CONFIG_BASE=$baseDir 
export PORTAL_API_STATIC_CONFIG=$baseDir/static
export PORTAL_API_DYNAMIC_CONFIG=$baseDir/dynamic
export NODE_ENV=test

export PORTAL_API_URL=http://localhost:3001
export PORTAL_PORTAL_URL=http://localhost:3000
export PORTAL_KONG_ADAPTER_URL=http://localhost:3002
export PORTAL_KONG_ADMIN_URL=http://localhost:8001
export PORTAL_MAILER_URL=http://localhost:3003
export PORTAL_CHATBOT_URL=http://localhost:3004

export HOOK_PORT=3111
export HOOK_HOST=localhost

pushd ../wicked.portal-api
node bin/api &> ${thisDir}/api-test-local.log &
apiPid=$!
popd

pushd portal-api
node node_modules/portal-env/await.js http://localhost:3001/ping
mocha
popd

echo Killing API at shutdown
kill $apiPid
