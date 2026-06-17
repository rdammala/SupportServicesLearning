import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { state, recordLatency, percentile } from "./state.js";

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logPath = path.join(__dirname, "..", "service.log");

function log(line) {
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`);
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", incidentMode: state.incidentMode });
});

app.post("/admin/incident/:action", (req, res) => {
  const action = req.params.action;
  if (action === "start") {
    state.incidentMode = true;
    log("INCIDENT_START");
    return res.json({ ok: true, incidentMode: true });
  }
  if (action === "stop") {
    state.incidentMode = false;
    log("INCIDENT_STOP");
    return res.json({ ok: true, incidentMode: false });
  }
  return res.status(400).json({ ok: false, message: "Use start or stop." });
});

app.get("/chat", async (_req, res) => {
  const start = Date.now();
  state.requestCount += 1;

  const baseLatency = 40 + Math.floor(Math.random() * 30);
  const degradedLatency = 700 + Math.floor(Math.random() * 1200);
  const sleepMs = state.incidentMode ? degradedLatency : baseLatency;

  await new Promise(resolve => setTimeout(resolve, sleepMs));

  const failChance = state.incidentMode ? 0.45 : 0.01;
  const failed = Math.random() < failChance;

  const duration = Date.now() - start;
  recordLatency(duration);

  if (failed) {
    state.errorCount += 1;
    log(`CHAT_FAILED latencyMs=${duration}`);
    return res.status(503).json({ ok: false, error: "Upstream dependency timeout" });
  }

  log(`CHAT_OK latencyMs=${duration}`);
  return res.json({ ok: true, response: "Hello from playground.", latencyMs: duration });
});

app.get("/metrics", (_req, res) => {
  const errorRate = state.requestCount === 0 ? 0 : state.errorCount / state.requestCount;
  res.json({
    incidentMode: state.incidentMode,
    requestCount: state.requestCount,
    errorCount: state.errorCount,
    errorRate,
    p50Ms: percentile(state.latenciesMs, 50),
    p95Ms: percentile(state.latenciesMs, 95)
  });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  log("SERVICE_START");
  // eslint-disable-next-line no-console
  console.log(`Ship/Observe/Recover service listening on http://localhost:${port}`);
});
