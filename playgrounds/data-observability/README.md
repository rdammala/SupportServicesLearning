# Data and Observability Playground

This playground generates synthetic service telemetry and analyzes it for:
- hot partition detection
- latency percentiles
- operation-level failure rates

## Beginner path

1. Run `npm install`
2. Run `npm run demo`
3. Open `src/events.ndjson`
4. Compare event distribution with the console table output

## Run

```powershell
npm install
npm run demo
```

## How to use manually

```powershell
npm run generate
npm run analyze
```

Output files:
- src/events.ndjson (generated sample data)

## What to learn

- How skewed partition keys create hot partitions
- How percentile and failure metrics reveal bottlenecks
- How to connect raw events to actionable reports
