# Ship Observe Recover Playground

This playground simulates a service incident lifecycle.

## Run

```powershell
npm install
npm run start
```

In another terminal:

```powershell
npm run demo
```

The demo will:
- start normal traffic
- trigger incident mode
- collect metrics
- execute recovery
- verify healthy state

## Manual commands

```powershell
npm run simulate
npm run incident:start
npm run incident:stop
npm run recover
```
