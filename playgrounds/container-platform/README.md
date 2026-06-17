# Container Platform Playground

This playground provides a local dry-run workflow for AKS-style manifests.

## Beginner path

1. Run `npm install`
2. Run `npm run demo`
3. Edit one manifest value (for example a port)
4. Run `npm run validate` and observe the validation response

## Run

```powershell
npm install
npm run demo
```

What it does:
- validates deployment/service/hpa consistency
- simulates rollout health checks and failure gates

## Manual commands

```powershell
npm run validate
npm run rollout
```

## Files
- manifests/deployment.yaml
- manifests/service.yaml
- manifests/hpa.yaml

## What to learn

- How deployment/service/hpa objects must align
- Why pre-rollout validation catches obvious misconfigurations early
- How rollout gates model safer production changes
