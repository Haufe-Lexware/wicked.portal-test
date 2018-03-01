#!/bin/bash

set -e

tmpDir=test-$(date +%Y%m%d%H%M%S)
mkdir -p ./tmp/$tmpDir
baseDir=$(pwd)/tmp/$tmpDir
thisDir=$(pwd)

echo "Test dir: $baseDir"

trap traperror ERR

apiPid=""
pgContainer=""

function killthings() {
    if [ ! -z "$apiPid" ]; then
        echo "===> Killing API"
        if ! kill $apiPid; then
            echo "Apparently the API was already dead."
        fi
    fi
    if [ ! -z "$pgContainer" ]; then
        echo "===> Killing Postgres container"
        docker rm -f $pgContainer
    fi
}
function traperror() {
    echo "*********************************"
    echo "Oh sh... killing all the things"
    echo "*********************************"

    killthings

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

export SWAGGER_RESOURCE_URL=http://localhost:8080
export PORTAL_API_URL=http://localhost:3001
export PORTAL_PORTAL_URL=http://localhost:3000
export PORTAL_KONG_ADAPTER_URL=http://localhost:3002
export PORTAL_KONG_ADMIN_URL=http://localhost:8001
export PORTAL_MAILER_URL=http://localhost:3003
export PORTAL_CHATBOT_URL=http://localhost:3004

export HOOK_PORT=3111
export HOOK_HOST=localhost

if [ -z "$1" ]; then
    echo "=== JSON mode"
    export WICKED_STORAGE=json
else 
    echo "=== Postgres mode"
    docker run -d --name $tmpDir -p 6543:5432 -e POSTGRES_USER=kong -e POSTGRES_PASSWORD=kong postgres:9.6
    pgContainer=$tmpDir
    # TODO: Make better
    sleep 10
    export WICKED_STORAGE=postgres
fi

pushd ../wicked.portal-api
node bin/api &> ${thisDir}/api-test-local.log &
apiPid=$!
popd

pushd portal-api
node node_modules/portal-env/await.js http://localhost:3001/ping
mocha
popd

killthings
