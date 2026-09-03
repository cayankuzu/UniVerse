import { createServer } from "node:http";

const port = 8080;
const serverTime = "2026-01-01T00:00:00.000Z";

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new Error("request_too_large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
    "content-type": "application/json; charset=utf-8",
  });
  response.end(body);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://mock-upstream");

  if (request.method === "GET" && url.pathname === "/health") {
    json(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/auth/v1/token") {
    await readBody(request);
    json(response, 200, {
      access_token: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJleHAiOjQxMDUwNDQ4MDB9.synthetic",
      expires_in: 3600,
      token_type: "bearer",
    });
    return;
  }

  if (request.method === "POST" && url.pathname.startsWith("/rest/v1/rpc/")) {
    let payload = {};
    try {
      const rawBody = await readBody(request);
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      json(response, 400, { code: "invalid_json", message: "Invalid synthetic request." });
      return;
    }

    json(response, 200, {
      delta_token: "synthetic-delta-token",
      items: [],
      next_cursor: payload.cursor ? null : "synthetic-next-cursor",
      server_time: serverTime,
    });
    return;
  }

  json(response, 404, { code: "not_found", message: "Synthetic route not found." });
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`[mock-upstream] listening on ${port}\n`);
});

function shutdown() {
  server.close((error) => process.exit(error ? 1 : 0));
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
