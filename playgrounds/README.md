# Capstone Playgrounds

This folder contains runnable local playgrounds for the four capstone labs.

## Run in the browser

If you want a browser-based environment, open this repo in Gitpod:

https://gitpod.io/#https://github.com/rdammala/SupportServicesLearning

Gitpod usage is metered by monthly credits, so you can use it in small chunks like 1 hour per day as long as you stay within the monthly allowance. The allowance resets each billing month; it does not have to be consumed consecutively.

## Prerequisites

- Node.js 20+ (verified with Node.js 24)
- A terminal (PowerShell is fine)
- Basic comfort with `cd`, `npm install`, and `npm run`

## For fresher developers

1. Start with one playground only.
2. Run `npm install` once in that folder.
3. Run `npm run demo` to see the happy path.
4. Read the output and map it to the capstone acceptance criteria.
5. Then run individual scripts to learn each step deeply.

## Playgrounds

1. ship-observe-recover
- Simulates a production service with incident mode, traffic generation, metrics, and recovery workflow.

2. data-observability
- Generates synthetic operational events and analyzes hot partitions, latency, and failures.

3. agentic-support-assistant
- Runs a local support assistant with tool-like actions over KB and ticket data.

4. container-platform
- Validates Kubernetes manifests and simulates rollout checks in dry-run mode.

## Quick start

From each playground folder:

```powershell
npm install
npm run demo
```

Or run each script individually as documented in that playground's README.

## Troubleshooting

- If a command says a module is missing, run `npm install` in that same folder.
- If you edited files and behavior looks odd, re-run `npm run demo` first to reset your baseline.
- For demo failure analysis and fixes, see [PLAYGROUND_FAILURE_CASE_STUDY.md](PLAYGROUND_FAILURE_CASE_STUDY.md).
