# NODE_VERSION set by build.sh based on .tool-versions file
ARG NODE_VERSION=latest
# Use standard Node.js image for building
FROM public.ecr.aws/docker/library/node:${NODE_VERSION} AS builder

# Build the lambda function
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Download and extract the secrets-lambda-extension.
#
# PINNED, both the alpine base and the release. Pipeline v2 builds one image and
# promotes those exact bytes to production, so every build input has to be a
# fixed version: `releases/latest/download/...` meant two builds of the same
# commit could ship different runtimes. v1.0.2 is also the release that made
# BUILD_NUMBER optional, which is what lets this image stop baking it (below).
FROM public.ecr.aws/docker/library/alpine:3.24.1 AS extension
ARG SECRETS_EXTENSION_VERSION=v1.0.2
RUN mkdir -p /opt/secrets-lambda-extension && \
    wget https://github.com/CruGlobal/secrets-lambda-extension/releases/download/${SECRETS_EXTENSION_VERSION}/secrets-lambda-extension-linux-amd64.tar.gz -q -O - |tar -xzC /opt/secrets-lambda-extension/

# Datadog Lambda extension, pinned. A named stage rather than an inline
# `COPY --from=public.ecr.aws/datadog/lambda-extension:latest` so the version is
# a literal tag on a FROM line: reproducible, and visible to Dependabot's docker
# ecosystem, which only ever parses FROM.
FROM public.ecr.aws/datadog/lambda-extension:99 AS datadog-extension

# NODE_VERSION set by build.sh based on .tool-versions file
ARG NODE_VERSION=latest
# Use AWS Lambda Node.js base image for the final image
FROM public.ecr.aws/lambda/nodejs:${NODE_VERSION}

# NOTHING environment-specific is baked into this image. Pipeline v2 builds once
# and promotes the same bytes from release-candidate to production, so the old
# ARG/ENV PROJECT_NAME + ENVIRONMENT + BUILD_NUMBER trio is gone: the
# aws/lambda/app Terraform module force-sets PROJECT_NAME and ENVIRONMENT as
# function environment variables, and BUILD_NUMBER is unused (it was a cache-key
# component the secrets extension hard-required before v1.0.2).

# Set the Lambda task root directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy the secrets-lambda-extension from the extension stage and setup wrapper
COPY --from=extension /opt/secrets-lambda-extension /opt/secrets-lambda-extension
ENV AWS_LAMBDA_EXEC_WRAPPER=/opt/secrets-lambda-extension/secrets-wrapper
ENV NODE_OPTIONS=--enable-source-maps

# Setup DataDog metrics/logs.
#
# esbuild leaves datadog-lambda-js and dd-trace external (see package.json's
# build script), so the runtime needs real copies of both. `npm ci --omit=dev`
# against the COMMITTED lockfile installs the exact versions the test suite ran
# against; the previous `npm install datadog-lambda-js dd-trace` resolved
# whatever was newest at build time, so the image could drift from the tested
# tree without any file changing. Driving it from the lockfile also means
# Dependabot's npm updates reach the image, which a hand-written version string
# here would not. The manifests are deleted afterwards so ${LAMBDA_TASK_ROOT}
# holds only node_modules plus the bundle — the bundle is CJS, and a stray
# package.json is one more thing that could change how node reads it.
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev && rm -f package.json package-lock.json
COPY --from=datadog-extension /opt/. /opt/
CMD ["node_modules/datadog-lambda-js/dist/handler.handler"]

# Copy the built application from the builder stage.
# esbuild writes dist/process-message.js (+ .map), so this lands the bundle at
# ${LAMBDA_TASK_ROOT}/process-message.js — which is both the `handler` value in
# Terraform (process-message.handler) and what the release-candidate verify
# command requires to prove the bundle loads.
COPY --from=builder /app/dist/* ./

# Build identity — the ONLY build-baked value, and last on purpose: nothing in
# the build needs it, so a new build number invalidates no earlier layer.
# "dev" covers local builds; build-candidate passes
# --build-arg VERSION=<yyyy-mm-dd>-<n>, which reaches here because build.sh
# already forwards $DOCKER_ARGS. Function config overlays image ENV per name and
# nothing sets DD_VERSION there, so this value shines through to Datadog.
ARG VERSION="dev"
ENV DD_VERSION=${VERSION}
