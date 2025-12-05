#!/bin/bash

set -e 

TST_DIR=$NX_WORKSPACE_ROOT/packages/app-ganymede/tests

cd $TST_DIR

if ! [ -d $TST_DIR/.venv ]; then
    python3 -m venv ./.venv
    ./.venv/bin/pip install openapi-spec-validator
fi

./.venv/bin/python -m openapi_spec_validator --errors all ../src/oas30.json

set +e 