# NODE_VERSION set by build.sh based on .tool-versions file
ARG NODE_VERSION=latest
# Use standard Node.js image for building
FROM public.ecr.aws/docker/library/node:${NODE_VERSION} AS builder

# Build the lambda function
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

# Download and extract the secrets-lambda-extension
FROM public.ecr.aws/docker/library/alpine:latest AS extension
RUN mkdir -p /opt/secrets-lambda-extension && \
    wget https://github.com/CruGlobal/secrets-lambda-extension/releases/download/v1.0.0/secrets-lambda-extension-linux-amd64.tar.gz -q -O - |tar -xzC /opt/secrets-lambda-extension/

# NODE_VERSION set by build.sh based on .tool-versions file
ARG NODE_VERSION=latest
# Use AWS Lambda Node.js base image for the final image
FROM public.ecr.aws/lambda/nodejs:${NODE_VERSION}

# Define GitHub Action Build Args
ARG PROJECT_NAME
ARG ENVIRONMENT
ARG BUILD_NUMBER

# Set environment variables for the Lambda function
ENV PROJECT_NAME=${PROJECT_NAME}
ENV ENVIRONMENT=${ENVIRONMENT}
ENV BUILD_NUMBER=${BUILD_NUMBER}

# Set the Lambda task root directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy the secrets-lambda-extension from the extension stage and setup wrapper
COPY --from=extension /opt/secrets-lambda-extension /opt/secrets-lambda-extension
ENV AWS_LAMBDA_EXEC_WRAPPER=/opt/secrets-lambda-extension/secrets-wrapper

# Setup DataDog metrics/logs
RUN npm install datadog-lambda-js dd-trace
COPY --from=public.ecr.aws/datadog/lambda-extension:latest /opt/. /opt/
CMD ["node_modules/datadog-lambda-js/dist/handler.handler"]

# Copy the built application from the builder stage
COPY --from=builder /app/dist/* ./
