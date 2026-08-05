# Working in this repo (for coding agents)

This repository is **`cru-ses-processor`** — a single AWS Lambda (container
image) that consumes every SES notification Cru sends, and does two things with
each one:

1. **Re-publishes it to the `all-ses-events-filterable` SNS topic** with the
   notification's interesting fields lifted into SNS **message attributes**, so
   other apps can subscribe with a filter policy instead of receiving everything.
   That republishing is the reason this app exists; `README.md` documents the
   attribute contract, and other teams' filter policies depend on it.
2. **Sends Datadog distribution metrics** — `cru.sesv2.bounce`,
   `cru.sesv2.complaint`, `cru.sesv2.delivery` — tagged by sender, recipient
   domain, subject, bounce type and so on.

It is a **handler invoked by an event**, not a web server with a port. There is
no HTTP surface and no URL.

## The loop

- **Unit tests are the loop** — `npm test` (jest). The suite is offline and
  fast; `tests/setup.js` loads `.env.test`.
- **Lint** — `npm run lint` (`standard`). CI runs lint and test together.
- **Build the bundle** — `npm run build` (esbuild → `dist/process-message.js`,
  CJS, with `datadog-lambda-js` and `dd-trace` deliberately left **external**).
- **Build the image** — `./build.sh` (reads the Node major from
  `.tool-versions`). Pass extra flags through `$DOCKER_ARGS`.

`handlers/process-message.js` exports **`handler`**. Keep that entry point and
export name: the Terraform module's `handler = "process-message.handler"`, the
esbuild `--outfile`, and the release-candidate verify command all depend on it.

## How this app ships

This repo is on **pipeline v2**: build one environment-neutral image, then
promote **that exact digest**. There is **no `staging` branch, no `On Staging`
label, and no merge-bot** — if you see those referenced anywhere, the reference
is stale.

1. **Work on a branch** off `main` and open a **Pull Request** back to `main`.
   PRs are **squash-merged with auto-merge** once the required checks pass.
2. **The PR title must be a Conventional Commit** (`fix(handlers): …`) — it
   becomes the squash commit subject, and the **Validate PR Title** check
   enforces it. The history *before* onboarding is free-form; that is history,
   not a precedent.
3. **Builds do not happen on push.** `.github/workflows/pipeline-v2.yml` runs on
   a **nightly-if-changed cron at 05:00 UTC** (midnight EST / 1am EDT) and on
   manual **`workflow_dispatch`**. A build produces a candidate image tagged
   `candidate-<yyyy-mm-dd>-<n>`. If `main` hasn't moved, the build reuses the
   existing candidate.
4. **Promotion to production and rollbacks** are Actions in
   [`cru-deploy`](https://github.com/CruGlobal/cru-deploy) — not workflows in
   this repo — driven by `cru app promote -n cru-ses-processor` /
   `cru app rollback -n cru-ses-processor`, which check that you have **push
   access** to this repo. Merging to `main` deploys nothing by itself.
5. **`release-*` image tags are permanent.** The ECR lifecycle policy claims
   every release-carrying digest ahead of every expiry rule, so any promoted
   image stays pullable and rollback targets never age out.
6. Deploy, promote, rollback and failure notifications go to Slack
   **#devops-notifications**.

### This app is STAGE-LESS — candidates are VERIFIED, not deployed

Most v2 apps gate a candidate by deploying it to a stage environment and having
a human look at it. **This app has no stage environment, on purpose**, so it
carries `RcMode: "verify"` instead:

- **Why there is no stage.** The only thing that invokes this function is the
  **production** SES notification stream — the `all-ses-events` SNS topic in
  us-east-1, plus a cross-region subscription to the us-west-2 topic that
  carries escom's SES traffic. There is no second, non-production SES stream to
  point a stage copy at, and a stage function subscribed to the production topic
  would double-publish every event onto `all-ses-events-filterable` and
  double-count every Datadog metric. So `cru-terraform` has **`prod/` only** —
  the missing `stage/` directory is the design, not an omission.
- **What the gate actually does.** `deploy-candidate` pulls the candidate image
  by digest and runs the app's `VerifyCommand` inside it —
  `node -e "require('/var/task/process-message.js')"` — with **no environment,
  no secrets, no network configuration**, and a hard 120s cap. A clean exit
  marks the candidate promotable and writes the same release-candidate ledger
  row a stage deploy would.
- **What it covers:** the image starts, and the bundle plus its two external
  runtime packages (`datadog-lambda-js`, `dd-trace`) load. That catches a broken
  build, a missing external, a syntax error, a bad Node major, a mangled
  `dist/` copy.
- **What it does NOT cover:** the SNS wiring, the IAM role, the SSM-injected
  secrets, the VPC, Datadog delivery, or whether a real notification is handled
  correctly. **A verify pass is a boot check, not an integration test.** If a
  change touches the SNS contract in `models/ses-message.js`, the unit tests are
  the only gate that will notice — write them.
- **Promote is a deliberate human step.** Nothing auto-promotes. Because the
  gate is weaker than a stage soak, "promote it and watch Datadog" is part of
  the procedure, not an afterthought: after a promote, check the
  `cru.sesv2.*` metrics are still arriving.

### No database migrations

Structurally none: `aws/lambda/app` has no migration mechanism, so every promote
reports `rollback-safe (no database migrations)`. Nothing to configure.

## Infrastructure & secrets

- **All infrastructure lives in `cru-terraform` under
  `applications/cru-ses-processor/`** — the app level (ECR repo, repo posture and
  ruleset, Datadog software catalog entry) and **`prod/` only** (the function,
  its IAM, the SNS permissions and subscriptions, the SSM parameters). Don't
  hand-write cloud resources.
- **Runtime environment variables**, all injected at runtime, never baked:
  - Set by Terraform: `SNS_SES_EVENTS_FILTERABLE_ARN` (the publish target),
    `SNS_ALL_SES_EVENTS_ARN`, `PROJECT_NAME` and `ENVIRONMENT` (the module
    force-sets those two), the `DD_*` extension variables, and `CRU_FLAGS_URL`.
  - Injected by the secrets-lambda-extension from SSM: `ROLLBAR_ACCESS_TOKEN`.
  - Baked into the image: **`DD_VERSION` only.** That is the single build-time
    identity value, and the reason the same bytes can run anywhere.
- **Never bake an environment into the image.** The Dockerfile deliberately no
  longer declares `PROJECT_NAME`, `ENVIRONMENT` or `BUILD_NUMBER` build args;
  re-adding any of them breaks build-once/promote.
- **Every build input is pinned** — the alpine stage, the
  `secrets-lambda-extension` release, the Datadog `lambda-extension` image, and
  the runtime `npm ci --omit=dev` driven by the committed `package-lock.json`.
  Keep it that way: an unpinned input means two builds of the same commit can
  produce different runtimes, which is exactly what promoting a digest is meant
  to rule out.
- **`test` (in `.github/workflows/nodejs.yml`) and `Validate PR Title` are
  required status checks**, declared in `cru-terraform`, not here. Renaming
  either job silently drops the gate.
- **Never commit secrets.** To run against a real environment's values, use
  `cru app impersonate -n cru-ses-processor -e production -- <command>`.

## Leftovers you can ignore

- **The `master` and `staging` branches are dead.** The default branch is
  `main`. `master` is a pre-rename leftover and `staging` is a merge-bot-era
  leftover; nothing builds, deploys or reports from either. Don't target them,
  don't "fix" them, don't resurrect them.
- **`.github/merge-bot.yml` was deleted** during onboarding. The v1
  `github-merge-bot` App acted on the `staging` branch and the `On Staging`
  label, neither of which exists under v2. Do not re-add the file: its
  *presence* is the one thing that could switch the App back on.
- **`.github/workflows/build-deploy-lambda.yml` is parked on purpose** —
  dispatch-only, no push trigger. It is the escape hatch if the v2 path itself
  breaks, and for Lambda it still works after the v2 applies (the build role is
  unchanged). Read the comment at the top before using it. Do not re-add the
  push trigger.
- **Commit history before onboarding is not Conventional Commits**, and
  `package.json`'s `version: 1.0.0` is meaningless — there is no release-please
  here. v2 versions releases with `release-*` image tags and the deployments
  ledger.
- **There is a backlog of open Dependabot security alerts** (46 at onboarding, 3
  critical). Enabling version updates starts working it down; a burst of PRs is
  expected, not a malfunction.
- **`.env.test` is test fixture data**, not real configuration.

## If you're not sure what to do

- **Keep changes small and on a branch.** Open a PR; don't push to `main`.
- **Treat the SNS message-attribute contract as public API.** Other teams'
  subscription filter policies read it, and a renamed or dropped attribute
  silently stops delivering their mail events. Add attributes; don't rename.
- **Don't invent infrastructure.** New topic, secret, or permission? That is a
  `cru-terraform` change — say so rather than configuring AWS by hand.
- **Don't add a stage environment to "fix" the missing one.** Verify mode is
  only valid in the app's `prod` directory, and a `stage/` directory would fight
  the prod one over the same app-info row. If stage genuinely becomes possible
  (a separate non-production SES stream), that is a DevOps conversation, not a
  Terraform copy-paste.
- **Ask about intent, not plumbing.** "What should happen to this event?" is a
  great question; make the technical calls yourself with sensible defaults.
- **Confirm before anything outward-facing or hard to undo** — pushing, opening
  PRs, promoting, deleting things.

Pipeline contract and rationale:
[`cru-deploy` → `docs/pipeline-v2.md`](https://github.com/CruGlobal/cru-deploy/blob/main/docs/pipeline-v2.md).
