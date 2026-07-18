import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { patAuthMiddleware } from "./auth.js";
import { registerAllTools } from "./tools/index.js";

const app = express();
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

const server = new McpServer({ name: "@humanfirst/mcp-server", version: "0.0.0" });
registerAllTools(server);

const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
await server.connect(transport);

app.all("/mcp", patAuthMiddleware, (req, res) => {
  transport.handleRequest(req, res, req.body);
});

const port = process.env.PORT ?? 3100;
app.listen(port, () => {
  console.log(`@humanfirst/mcp-server listening on port ${port}`);
});
