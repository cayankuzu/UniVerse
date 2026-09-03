const apiUrl = process.env.TOXIPROXY_API_URL || "http://toxiproxy:8474";
const proxyUrl = process.env.TOXIPROXY_PROXY_URL || "http://toxiproxy:8666";
const upstream = process.env.UPSTREAM_ADDRESS || "mock-upstream:8080";
const proxyName = "universe-upstream";

async function api(path, options = {}, expected = [200]) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    signal: AbortSignal.timeout(3_000),
  });
  if (!expected.includes(response.status)) {
    throw new Error(`Toxiproxy API ${path} returned ${response.status}.`);
  }
  return response;
}

async function proxyHealth({ expectFailure = false, timeout = 2_000 } = {}) {
  let response;
  try {
    response = await fetch(`${proxyUrl}/health`, { signal: AbortSignal.timeout(timeout) });
  } catch (error) {
    if (expectFailure) return;
    throw error;
  }

  if (expectFailure) throw new Error("Faulted proxy unexpectedly returned a response.");
  if (!response.ok) throw new Error(`Proxy health returned ${response.status}.`);
  return response;
}

await api(`/proxies/${proxyName}`, { method: "DELETE" }, [204, 404]);
await api(
  "/proxies",
  {
    body: JSON.stringify({
      enabled: true,
      listen: "0.0.0.0:8666",
      name: proxyName,
      upstream,
    }),
    method: "POST",
  },
  [201],
);

await proxyHealth();

await api(
  `/proxies/${proxyName}/toxics`,
  {
    body: JSON.stringify({
      attributes: { jitter: 0, latency: 250 },
      name: "fixed-latency",
      stream: "downstream",
      toxicity: 1,
      type: "latency",
    }),
    method: "POST",
  },
  [200],
);
const latencyStartedAt = performance.now();
await proxyHealth();
const elapsed = performance.now() - latencyStartedAt;
if (elapsed < 200) throw new Error(`Latency toxic was not applied (${elapsed.toFixed(1)}ms).`);
await api(`/proxies/${proxyName}/toxics/fixed-latency`, { method: "DELETE" }, [204]);

await api(
  `/proxies/${proxyName}/toxics`,
  {
    body: JSON.stringify({
      attributes: { timeout: 0 },
      name: "reset-peer",
      stream: "downstream",
      toxicity: 1,
      type: "reset_peer",
    }),
    method: "POST",
  },
  [200],
);
await proxyHealth({ expectFailure: true, timeout: 1_000 });
await api(`/proxies/${proxyName}/toxics/reset-peer`, { method: "DELETE" }, [204]);

await api(
  `/proxies/${proxyName}`,
  { body: JSON.stringify({ enabled: false }), method: "POST" },
  [200],
);
await proxyHealth({ expectFailure: true, timeout: 1_000 });
await api(
  `/proxies/${proxyName}`,
  { body: JSON.stringify({ enabled: true }), method: "POST" },
  [200],
);
await proxyHealth();

process.stdout.write(
  `[resilience] pass: baseline, ${elapsed.toFixed(0)}ms latency, reset, outage, and recovery.\n`,
);
