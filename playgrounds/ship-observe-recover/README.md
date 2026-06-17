# Ship Observe Recover Playground

This playground simulates a service incident lifecycle.

## Beginner path

1. Run `npm install`
2. Run `npm run demo`
3. Read the baseline vs incident metrics (`errorRate`, `p95Ms`)
4. Re-run and compare your numbers

## Fast start

```powershell
npm install
npm run demo
```

The demo will:
- start normal traffic
- trigger incident mode
- collect metrics
- execute recovery
- verify healthy state

## How to use manually

If you want to explore each phase step-by-step:

Terminal 1:
```powershell
npm run start
```

Terminal 2:
```powershell
npm run simulate
npm run incident:start
npm run simulate
npm run recover
```

## What to learn

- Why incident mode drives higher latency and errors
- How to detect degradation from metrics
- How to validate post-recovery health quickly
