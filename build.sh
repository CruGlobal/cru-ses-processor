#!/usr/bin/env bash

docker buildx build $DOCKER_ARGS \
  --build-arg NODE_VERSION=$(grep nodejs .tool-versions|awk '{ print $NF }'|cut -d'.' -f1) \
  .
