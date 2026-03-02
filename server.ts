import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // --- API Routes ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Ollama Proxy Route
  app.post("/api/ollama/chat", async (req, res) => {
    const { model, messages, stream, options } = req.body;
    const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

    try {
      // We are proxying the request to the local Ollama instance
      const response = await axios.post(`${ollamaUrl}/api/chat`, {
        model: model || "qwen3:8b", // Default, but user should specify
        messages,
        stream: false, // For simplicity in this MVP, we'll disable streaming initially
        options
      });

      const respData = response.data as any;
      // normalization: some models may put reasoning/thoughts in choices[0].message
      if (respData.choices && respData.choices[0]?.message) {
        const msg = respData.choices[0].message;
        if (msg.reasoning && !msg.thoughts) {
          msg.thoughts = msg.reasoning;
        }
        respData.message = msg;
      }
      if (respData.reasoning && !respData.thoughts) {
        respData.thoughts = respData.reasoning;
      }

      res.json(respData);
    } catch (error: any) {
      console.error("Ollama connection error:", error.message);
      res.status(502).json({
        error: "Failed to connect to Ollama",
        details: error.message,
        hint: "Ensure Ollama is running locally on port 11434."
      });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, we would serve static files from dist/
    // But for this environment, we rely on the dev setup mostly.
    // Adding basic static serve for completeness if built.
    const path = await import("path");
    app.use(express.static(path.resolve("dist")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
