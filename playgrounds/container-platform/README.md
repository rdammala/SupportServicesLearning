# Container Platform Playground

This playground provides a local dry-run workflow for AKS-style manifests.

## Run

```powershell
npm install
npm run demo
```

What it does:
- validates deployment/service/hpa consistency
- simulates rollout health checks and failure gates

## Files
- manifests/deployment.yaml
- manifests/service.yaml
- manifests/hpa.yaml
