#!/bin/bash

TST_DIR=$NX_WORKSPACE_ROOT/apps/ganymede/tests

cd $TST_DIR

if ! [ -d $TST_DIR/.venv ]; then
    python3 -m venv ./.venv
    source ./.venv/bin/activate
    pip install openapi-spec-validator
fi

source ./.venv/bin/activate

openapi-spec-validator  --errors all ../src/app/oas30.json