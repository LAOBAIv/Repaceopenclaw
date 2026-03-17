import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { initDb } from "./db/client";
import agentRoutes from "./routes/agents";
import projectRoutes from "./routes/projects";
import conversationRoutes from "./routes/conversations";
import taskRoutes from "./routes/tasks";
import tokenChannelRoutes from "./routes/tokenChannels";
import botChannelRoutes from "./routes/botChannels";
import searchRoutes from "./routes/search";
import exportImportRoutes from "./routes/exportImport";
import skillRoutes from "./routes/skills";
import pluginRoutes from "./routes/plugins";
import { errorHandler } from "./middleware/errorHandler";
import { setupWebSocket } from "./ws/wsHandler";
import authRoutes from "./routes/auth";
import openaiCompatRoutes from "./routes/openaiCompat";

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
  app.use("/api/auth", authRoutes);
  app.use("/api/agents", agentRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/token-channels", tokenChannelRoutes);
  app.use("/api/bot-channels", botChannelRoutes);
  app.use("/api/search", searchRoutes);
  // GET /api/export = full data export; POST /api/export or POST /api/import = data import
  app.use("/api/export", exportImportRoutes);
  app.use("/api/import", exportImportRoutes);
  app.use("/api/skills", skillRoutes);
  app.use("/api/plugins", pluginRoutes);

  // OpenAI 兼容对外接口（供 OpenClaw / Claude Code / OpenCode 等工具接入）
  // GET  /v1/models
  // POST /v1/chat/completions
  app.use("/v1", openaiCompatRoutes);

  // 静态文件服务 - 前端 dist 目录
  const staticPath = path.join(__dirname, "../../frontend/dist");
  app.use(express.static(staticPath));
  
  // 所有非 API 路由都指向 index.html
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api") && !req.path.startsWith("/v1") && !req.path.startsWith("/ws")) {
      res.sendFile(path.join(staticPath, "index.html"));
    }
  });

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
