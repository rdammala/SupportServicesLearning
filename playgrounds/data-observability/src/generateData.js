import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outPath = path.join(__dirname, "events.ndjson");

const partitions = ["customer-001", "customer-002", "customer-003", "customer-004"];
const operations = ["CreateTicket", "GetTicket", "ResolveTicket", "SendNotification"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const lines = [];

for (let i = 0; i < 1200; i += 1) {
  const hotPartitionBias = Math.random() < 0.45 ? "customer-001" : pick(partitions);
  const operation = pick(operations);
  const failure = hotPartitionBias === "customer-001" && Math.random() < 0.12;
  const baseLatency = hotPartitionBias === "customer-001" ? 240 : 80;
  const latencyMs = baseLatency + Math.floor(Math.random() * 160);

  lines.push(JSON.stringify({
    timestamp: new Date(Date.now() - (1200 - i) * 1000).toISOString(),
    partitionKey: hotPartitionBias,
    operation,
    success: !failure,
    latencyMs
  }));
}

fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
// eslint-disable-next-line no-console
console.log(`Generated ${lines.length} events to ${outPath}`);
