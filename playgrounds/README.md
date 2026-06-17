# Capstone Playgrounds

This folder contains runnable local playgrounds for the four capstone labs.

## Prerequisites

- Node.js 20+ (verified with Node.js 24)

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
