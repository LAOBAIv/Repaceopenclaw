import express from "express";
import cors from "cors";
import http from "http";
import { initDb } from "./db/client";
import agentRoutes from "./routes/agents";
import projectRoutes from "./routes/projects";
import conversationRoutes from "./routes/conversations";
import taskRoutes from "./routes/tasks";
import tokenChannelRoutes from "./routes/tokenChannels";
import searchRoutes from "./routes/search";
import exportImportRoutes from "./routes/exportImport";
import skillRoutes from "./routes/skills";
import pluginRoutes from "./routes/plugins";
import { errorHandler } from "./middleware/errorHandler";
import { setupWebSocket } from "./ws/wsHandler";

const PORT = process.env.PORT || 3001;

async function main() {
  await initDb();
  console.log("[DB] Database initialized");

  const app = express();
  app.use(cors({ origin: "*" }));
  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API routes
  app.use("/api/agents", agentRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/token-channels", tokenChannelRoutes);
  app.use("/api/search", searchRoutes);
  // GET /api/export = full data export; POST /api/export or POST /api/import = data import
  app.use("/api/export", exportImportRoutes);
  app.use("/api/import", exportImportRoutes);
  app.use("/api/skills", skillRoutes);
  app.use("/api/plugins", pluginRoutes);

  // Error handler
  app.use(errorHandler);

  // Create HTTP server and attach WebSocket
  const server = http.createServer(app);
  setupWebSocket(server);

  server.listen(PORT, () => {
    console.log(`[Server] Running at http://localhost:${PORT}`);
    console.log(`[WS] WebSocket at ws://localhost:${PORT}/ws`);
  });
}

main().catch((err) => {
  console.error("[Fatal]", err);
  process.exit(1);
});
