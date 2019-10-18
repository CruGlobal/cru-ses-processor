#!/usr/bin/env bash

# Set PROJECT_NAME and ENVIRONMENT for testing/demo
export PROJECT_NAME=cru-ses-processor
export ENVIRONMENT=production

# Export environment variables for use with serverless
source $ECS_CONFIG/bin/load_environment.sh
load_environment

set -x && npx serverless --stage $ENVIRONMENT $@
