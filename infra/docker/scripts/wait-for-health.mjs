const target = process.argv[2];
const attempts = Number.parseInt(process.argv[3] || "30", 10);

if (!target) throw new Error("Usage: node wait-for-health.mjs <url> [attempts]");

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(2_000) });
    if (response.ok) {
      process.stdout.write(`[wait-for-health] healthy: ${target}\n`);
      process.exit(0);
    }
  } catch {
    // Retry without logging response details; validation URLs may contain test-only routing data.
  }
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
}

throw new Error(`[wait-for-health] timed out: ${target}`);
