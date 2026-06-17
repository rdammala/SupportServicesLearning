async function recover() {
  const baseUrl = process.env.BASE_URL || "http://localhost:3001";
  await fetch(`${baseUrl}/admin/incident/stop`, { method: "POST" });

  let healthy = 0;
  for (let i = 0; i < 25; i += 1) {
    const response = await fetch(`${baseUrl}/chat`);
    if (response.ok) {
      healthy += 1;
    }
  }

  const metrics = await fetch(`${baseUrl}/metrics`).then(r => r.json());

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ postRecoveryHealthyResponses: healthy, metrics }, null, 2));
}

recover();
