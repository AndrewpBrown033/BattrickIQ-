import express from "express";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
  });

  // NOTE: full routes restored at build via scripts/restore-server.cjs
  // This stub is replaced on every npm run build/dev.
  app.post("/api/sync-battrick-step", async (_req, res) => {
    res.status(503).json({ error: "Server bootstrap incomplete — rebuild to restore routes" });
  });

  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
