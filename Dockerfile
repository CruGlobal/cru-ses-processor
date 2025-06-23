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

ARG NODE_VERSION=latest
# Use AWS Lambda Node.js base image for the final image
FROM public.ecr.aws/lambda/nodejs:${NODE_VERSION}

WORKDIR ${LAMBDA_TASK_ROOT}
# Copy the built application from the builder stage
COPY --from=builder /app/dist/* ./

# Set the default handler for the container, this can be changed in Terraform if multiple handlers are used
CMD ["process-message.handler"]
