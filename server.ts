import express from "express";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // CRITICAL: full server restored in next commits — temporary bootstrap
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
  });

  app.post("/api/sync-battrick-step", async (req, res) => {
    res.status(503).json({
      error: "Server restore in progress. Please wait for the next deploy, or use paste HTML for transfer scan."
    });
  });

  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
