import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { executeWorkflow, resumeRun } from "./orchestrator.js";
import { listRunSummaries, loadRun } from "./persist.js";
import { resolveWorkflow, workflowRegistry } from "./workflows/registry.js";

export const API_PORT = Number(process.env.AETHER_API_PORT ?? 8787);

const CORS = {
  "Access-Control-Allow-Origin": process.env.AETHER_CORS_ORIGIN ?? "http://localhost:3000",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json", ...CORS });
  res.end(JSON.stringify(body, null, 2));
}

function notFound(res: ServerResponse): void {
  json(res, 404, { error: "not_found" });
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function uniqueWorkflows(): { id: string; name: string; description?: string }[] {
  const seen = new Set<string>();
  const out: { id: string; name: string; description?: string }[] = [];
  for (const entry of Object.values(workflowRegistry)) {
    if (seen.has(entry.workflow.id)) continue;
    seen.add(entry.workflow.id);
    out.push({
      id: entry.workflow.id,
      name: entry.workflow.name,
      description: entry.workflow.description,
    });
  }
  return out;
}

export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${API_PORT}`);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  try {
    if (method === "GET" && pathname === "/health") {
      json(res, 200, { ok: true, service: "aether-forge-api" });
      return;
    }

    if (method === "GET" && pathname === "/workflows") {
      json(res, 200, { workflows: uniqueWorkflows() });
      return;
    }

    if (method === "GET" && pathname === "/runs") {
      json(res, 200, { runs: await listRunSummaries() });
      return;
    }

    const runMatch = pathname.match(/^\/runs\/([^/]+)$/);
    if (method === "GET" && runMatch) {
      try {
        const run = await loadRun(runMatch[1]);
        json(res, 200, { run });
      } catch {
        notFound(res);
      }
      return;
    }

    if (method === "POST" && pathname === "/runs") {
      const body = (await readBody(req)) as { workflowId?: string };
      const workflowId = body.workflowId ?? url.searchParams.get("workflow") ?? "hello";
      const { workflow, agents } = resolveWorkflow(workflowId);
      const run = await executeWorkflow(workflow, agents);
      json(res, 201, { run });
      return;
    }

    const actionMatch = pathname.match(/^\/runs\/([^/]+)\/(approve|reject)$/);
    if (method === "POST" && actionMatch) {
      const run = await resumeRun(
        actionMatch[1],
        actionMatch[2] as "approve" | "reject",
      );
      json(res, 200, { run });
      return;
    }

    notFound(res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("Unknown workflow") || message.includes("Invalid run")
      ? 400
      : message.includes("expected awaiting_approval")
        ? 409
        : 500;
    json(res, status, { error: message });
  }
}

export function startApiServer(port = API_PORT) {
  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Aether Forge API listening on http://127.0.0.1:${port}`);
  });
  return server;
}

const isDirect =
  process.argv[1]?.includes("api") ||
  process.argv[1]?.endsWith("api.ts") ||
  process.argv[1]?.endsWith("api.js");

if (isDirect) {
  startApiServer();
}
