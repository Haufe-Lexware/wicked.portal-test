#!/bin/bash

node ../portal-env/await.js http://portal-api:3001/ping

mocha
