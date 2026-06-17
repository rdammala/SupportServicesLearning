# Playground Demo Failure Case Study

## Context

While validating the newly created capstone playgrounds, three demos were passing consistently:
- data-observability
- agentic-support-assistant
- container-platform

The `ship-observe-recover` demo initially failed intermittently and then produced noisy runtime behavior in different terminal states.

## What went wrong

### Failure 1: Connection refused (`ECONNREFUSED`)

Symptom:
- `npm run demo` attempted to call `/chat` before a server was reachable.

Root cause:
- Early demo workflow expected the service to already be running in a separate terminal.
- If the service was not started first, traffic simulation failed immediately.

Impact:
- Demo failed on first step.
- New users had a confusing experience.

### Failure 2: Port already in use (`EADDRINUSE` on `3001`)

Symptom:
- Starting the service sometimes crashed with `EADDRINUSE`.

Root cause:
- A stale or parallel node process still held port `3001`.
- The demo process and manual process could collide.

Impact:
- Logs looked alarming even when some requests still succeeded.
- Reduced confidence in the playground's reliability.

### Failure 3: Fragile process orchestration

Symptom:
- Mixed behavior depending on which terminal started what first.

Root cause:
- Demo orchestration relied on manual process sequencing.
- Scripts had hard-coded base URL assumptions.

Impact:
- Hard to reproduce consistent outcomes for fresh developers.

## How the issues were detected

1. Ran each playground demo individually and compared outputs.
2. Observed only `ship-observe-recover` failing.
3. Captured terminal output showing:
- `ECONNREFUSED` when server absent
- `EADDRINUSE` when port conflict occurred
4. Re-ran in controlled order to confirm sequence sensitivity.

## Fixes implemented

### Fix 1: Self-contained demo orchestration

Changed behavior:
- `npm run demo` now runs `src/fullDemo.js`.
- `fullDemo.js` starts the service process internally, waits for health, runs all phases, and exits.

Benefit:
- No manual two-terminal setup needed for default path.

### Fix 2: Dynamic port allocation

Changed behavior:
- `fullDemo.js` allocates a free ephemeral port at runtime.
- The child service uses that port via `PORT` env var.

Benefit:
- Eliminates hard dependency on port `3001`.
- Avoids collision with stale local processes.

### Fix 3: Base URL propagation

Changed behavior:
- Scripts read `BASE_URL` (fallback to localhost:3001 if unset).
- Demo injects `BASE_URL` consistently into child commands.

Benefit:
- All request scripts target the same runtime endpoint deterministically.

### Fix 4: Beginner-first documentation

Changed behavior:
- README updates explain exact startup sequence.
- Added beginner path, manual path, and learning objectives per playground.

Benefit:
- Fresh developers can start from known-good command flow.

## Optimization outcomes

1. Deterministic startup:
- Demo no longer depends on external terminal state.

2. Port conflict resilience:
- Free-port allocation avoids local collisions.

3. Better developer experience:
- One-command execution for first-time use.
- Clear progression from demo to manual exploration.

4. Easier debugging:
- Smaller failure surface because orchestration is centralized.

## Preventive guidance for future playgrounds

1. Avoid hard-coded ports in multi-script demos.
2. Prefer one self-contained `demo` orchestration script.
3. Pass runtime configuration via env vars (`BASE_URL`, `PORT`).
4. Include health-check wait logic before traffic generation.
5. Document both:
- fast path (`npm run demo`)
- deep path (manual step-by-step commands)

## Quick verification checklist

Use this after changes:

1. `npm run demo` works from a clean terminal.
2. Running `npm run demo` twice in a row still works.
3. Manual path commands still function.
4. Exit code is `0` on success.
5. No dependency/runtime artifacts are committed (`node_modules`, logs, generated data).
