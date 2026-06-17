import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inPath = path.join(__dirname, "events.ndjson");

if (!fs.existsSync(inPath)) {
  // eslint-disable-next-line no-console
  console.error("Missing events.ndjson. Run npm run generate first.");
  process.exit(1);
}

const events = fs
  .readFileSync(inPath, "utf8")
  .trim()
  .split("\n")
  .map(line => JSON.parse(line));

const byPartition = new Map();
const byOperation = new Map();

for (const e of events) {
  if (!byPartition.has(e.partitionKey)) {
    byPartition.set(e.partitionKey, []);
  }
  byPartition.get(e.partitionKey).push(e);

  if (!byOperation.has(e.operation)) {
    byOperation.set(e.operation, { total: 0, failures: 0 });
  }
  const stats = byOperation.get(e.operation);
  stats.total += 1;
  stats.failures += e.success ? 0 : 1;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] || 0;
}

const partitionReport = [...byPartition.entries()]
  .map(([partitionKey, arr]) => ({
    partitionKey,
    count: arr.length,
    p95LatencyMs: percentile(arr.map(x => x.latencyMs), 95),
    failureRate: arr.filter(x => !x.success).length / arr.length
  }))
  .sort((a, b) => b.count - a.count);

const hotPartition = partitionReport[0];

const operationReport = [...byOperation.entries()].map(([operation, s]) => ({
  operation,
  total: s.total,
  failureRate: s.failures / s.total
}));

// eslint-disable-next-line no-console
console.log("Partition report:");
// eslint-disable-next-line no-console
console.table(partitionReport);

// eslint-disable-next-line no-console
console.log("Operation report:");
// eslint-disable-next-line no-console
console.table(operationReport);

// eslint-disable-next-line no-console
console.log(`Hot partition candidate: ${hotPartition.partitionKey}`);
