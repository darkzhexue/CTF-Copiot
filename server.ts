import express from "express";
import axios from "axios";
import path from "path";

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Track current streaming request to Ollama so we can cancel it.
  let currentOllamaController: AbortController | null = null;
  let currentOllamaResponse: any = null;

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // List installed Ollama models for selector UI.
  app.get("/api/ollama/models", async (_req, res) => {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    try {
      const response = await axios.get(`${ollamaUrl}/api/tags`, { responseType: "json" });
      const models = Array.isArray(response.data?.models)
        ? response.data.models
            .map((item: any) => item?.name)
            .filter((name: any) => typeof name === "string" && name.trim().length > 0)
        : [];

      return res.json({ models });
    } catch (error: any) {
      console.error("Failed to fetch Ollama models:", error?.message || error);
      return res.status(502).json({
        error: "Failed to fetch Ollama models",
        details: error?.message || String(error),
        hint: "Ensure Ollama is running locally on port 11434.",
      });
    }
  });

  // Ollama proxy route
  app.post("/api/ollama/chat", async (req, res) => {
    const { model, messages, stream, options } = req.body as any;
    const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

    try {
      const payload: any = {
        model: model || "qwen3:8b",
        messages,
        stream: !!stream,
        options,
      };

      if (stream) {
        const controller = new AbortController();
        currentOllamaController = controller;

        try {
          const response = await axios.post(`${ollamaUrl}/api/chat`, payload, {
            responseType: "stream",
            signal: controller.signal,
          });

          currentOllamaResponse = response;
          res.setHeader("Content-Type", response.headers["content-type"] || "text/event-stream");

          response.data.on("data", (chunk: any) => {
            try {
              res.write(chunk);
            } catch {
              // Ignore write errors.
            }
          });

          response.data.on("end", () => {
            try {
              res.end();
            } catch {}
            currentOllamaController = null;
            currentOllamaResponse = null;
          });

          response.data.on("error", (err: any) => {
            console.error("Stream error from Ollama:", err);
            try {
              res.end();
            } catch {}
            currentOllamaController = null;
            currentOllamaResponse = null;
          });
        } catch (err: any) {
          console.error("Error proxying stream to Ollama:", err?.message || err);
          try {
            res.end();
          } catch {}
          currentOllamaController = null;
          currentOllamaResponse = null;
        }

        return;
      }

      // Non-streaming request: regular proxy and normalization.
      const response = await axios.post(`${ollamaUrl}/api/chat`, payload, { responseType: "json" });
      const respData = response.data as any;

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
      console.error("Ollama connection error:", error?.message || error);
      if (!res.headersSent) {
        res.status(502).json({
          error: "Failed to connect to Ollama",
          details: error?.message || String(error),
          hint: "Ensure Ollama is running locally on port 11434.",
        });
      } else {
        try {
          res.end();
        } catch {}
      }
    }
  });

  // Abort currently proxied Ollama request (if any).
  app.post("/api/ollama/abort", (_req, res) => {
    try {
      if (currentOllamaController) {
        try {
          currentOllamaController.abort();
        } catch {}
        currentOllamaController = null;
      }

      if (
        currentOllamaResponse &&
        currentOllamaResponse.data &&
        typeof currentOllamaResponse.data.destroy === "function"
      ) {
        try {
          currentOllamaResponse.data.destroy();
        } catch {}
        currentOllamaResponse = null;
      }

      return res.json({ aborted: true });
    } catch (e: any) {
      return res.status(500).json({ aborted: false, error: e?.message || String(e) });
    }
  });

  const isPkg = typeof (process as any).pkg !== "undefined";

  if (process.env.NODE_ENV !== "production" && !isPkg) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = isPkg
      ? path.join(path.dirname(process.execPath), "dist")
      : path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();