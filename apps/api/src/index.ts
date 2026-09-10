import http from "node:http";
import { URL } from "node:url";
import {
  WarEraApiError,
  WarEraClient,
} from "@wera/warera-client";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const warera = new WarEraClient({
  apiKey: process.env.WARERA_API_KEY,
  baseUrl: process.env.WARERA_API_BASE_URL,
});

function json(
  response: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  response.statusCode = status;
  response.setHeader(
    "content-type",
    "application/json; charset=utf-8",
  );
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "localhost"}`,
  );

  if (request.method === "GET" && url.pathname === "/") {
    json(response, 200, {
      name: "WERA",
      service: "api",
      status: "running",
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    json(response, 200, {
      ok: true,
      service: "wera-api",
      version: "0.1.0",
      wareraConfigured: warera.isConfigured(),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (
    request.method === "GET" &&
    url.pathname === "/warera/status"
  ) {
    if (!warera.isConfigured()) {
      json(response, 503, {
        ok: false,
        connected: false,
        error: "WARERA_API_KEY is not configured.",
      });
      return;
    }

    json(response, 200, {
      ok: true,
      connected: true,
      message:
        "WarEra credentials are configured. Endpoint verification comes next.",
    });
    return;
  }

  json(response, 404, {
    ok: false,
    error: "NOT_FOUND",
  });
});

server.listen(port, host, () => {
  console.log(
    `WERA API listening on http://${host}:${port}`,
  );
});

process.on("SIGTERM", () => {
  server.close(() => {
    process.exit(0);
  });
});
