async function hitChat() {
  const baseUrl = process.env.BASE_URL || "http://localhost:3001";
  const start = Date.now();
  const response = await fetch(`${baseUrl}/chat`);
  const duration = Date.now() - start;
  return { ok: response.ok, duration };
}

async function run(count = 80) {
  let errors = 0;
  const latencies = [];

  for (let i = 0; i < count; i += 1) {
    const result = await hitChat();
    if (!result.ok) {
      errors += 1;
    }
    latencies.push(result.duration);
  }

  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const errorRate = errors / count;

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ count, errors, errorRate, p95Ms: p95 }, null, 2));
}

run();
