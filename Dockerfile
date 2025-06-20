# NODE_VERSION set by build.sh based on .tool-versions file
ARG NODE_VERSION=latest
FROM public.ecr.aws/docker/library/node:${NODE_VERSION} AS builder

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

ARG NODE_VERSION=latest
FROM public.ecr.aws/lambda/nodejs:${NODE_VERSION}

WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/dist/* ./

CMD ["main.handler"]
