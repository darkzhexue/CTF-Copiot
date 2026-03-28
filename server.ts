import express from "express";
import axios from "axios";
import path from "path";
import multer from "multer";
import { RagService } from "./rag-service";

const PORT = 3000;

const countCjkChars = (value: string) => {
  const matches = value.match(/[\u3400-\u9fff\uf900-\ufaff]/g);
  return matches ? matches.length : 0;
};

const normalizeUploadedFilename = (fileName: string) => {
  const trimmed = String(fileName || "").trim();
  if (!trimmed) return "unnamed-file";

  const utf8Candidate = Buffer.from(trimmed, "latin1").toString("utf8");
  const originalCjkCount = countCjkChars(trimmed);
  const candidateCjkCount = countCjkChars(utf8Candidate);

  const hasMojibakeHint = /[ÃÂæçé¥œž¤]/.test(trimmed);
  const candidateLooksBetter =
    candidateCjkCount > originalCjkCount ||
    (hasMojibakeHint && !utf8Candidate.includes("�")) ||
    (utf8Candidate.includes(".") && !trimmed.includes("."));

  const normalized = candidateLooksBetter ? utf8Candidate : trimmed;
  return normalized.replace(/[\\/]+/g, "_");
};

async function startServer() {
  const app = express();
  // Images are sent as base64 inside JSON; default 100kb is too small.
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  // Track current streaming request to Ollama so we can cancel it.
  let currentOllamaController: AbortController | null = null;
  let currentOllamaResponse: any = null;
  const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

  const ragService = new RagService({
    baseDir: path.resolve(process.cwd(), "data", "rag"),
    chunkSize: Number(process.env.RAG_CHUNK_SIZE || 900),
    chunkOverlap: Number(process.env.RAG_CHUNK_OVERLAP || 150),
    embeddingDim: Number(process.env.RAG_EMBED_DIM || 256),
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: Number(process.env.RAG_MAX_FILE_BYTES || 20 * 1024 * 1024),
      files: Number(process.env.RAG_MAX_FILES || 50),
    },
  });

  const ragMinScore = Math.max(0, Math.min(1, Number(process.env.RAG_MIN_SCORE || 0.12)));

  const normalizeOllamaResponse = (respData: any) => {
    if (respData?.choices && respData?.choices[0]?.message) {
      const msg = respData.choices[0].message;
      if (msg.reasoning && !msg.thoughts) {
        msg.thoughts = msg.reasoning;
      }
      respData.message = msg;
    }

    if (respData?.reasoning && !respData?.thoughts) {
      respData.thoughts = respData.reasoning;
    }

    return respData;
  };

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // List installed Ollama models for selector UI.
  app.get("/api/ollama/models", async (_req, res) => {
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

  // RAG status for UI and diagnostics.
  app.get("/api/rag/status", async (_req, res) => {
    try {
      const status = await ragService.getStatus();
      return res.json(status);
    } catch (error: any) {
      return res.status(500).json({
        error: "Failed to read RAG status",
        details: error?.message || String(error),
      });
    }
  });

  app.get("/api/rag/documents", async (_req, res) => {
    try {
      const documents = await ragService.listDocuments();
      return res.json({ documents });
    } catch (error: any) {
      return res.status(500).json({
        error: "Failed to read RAG documents",
        details: error?.message || String(error),
      });
    }
  });

  app.delete("/api/rag/documents/:documentId", async (req, res) => {
    try {
      const result = await ragService.deleteDocument(String(req.params.documentId || ""));
      if (!result.deleted) {
        return res.status(404).json({
          error: "Document not found",
        });
      }

      const status = await ragService.getStatus();
      const documents = await ragService.listDocuments();
      return res.json({
        ...result,
        status,
        documents,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Failed to delete RAG document",
        details: error?.message || String(error),
      });
    }
  });

  // RAG ingestion route: accepts PDF/Markdown files and stores chunked corpus.
  app.post("/api/rag/import", upload.array("files"), async (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) {
      return res.status(400).json({
        error: "No files uploaded",
        hint: "Use multipart/form-data with field name 'files'.",
      });
    }

    try {
      const result = await ragService.importDocuments(
        files.map((file) => ({
          originalName: normalizeUploadedFilename(file.originalname),
          mimeType: file.mimetype,
          buffer: file.buffer,
        }))
      );

      const autoIndex = req.body?.autoIndex !== "false";
      const indexingResult = autoIndex ? await ragService.reindex() : null;
      const status = await ragService.getStatus();

      return res.json({
        ...result,
        autoIndexed: autoIndex,
        indexing: indexingResult,
        status,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: "Failed to import documents",
        details: error?.message || String(error),
      });
    }
  });

  // Force a full local embedding rebuild.
  app.post("/api/rag/reindex", async (_req, res) => {
    try {
      const indexing = await ragService.reindex();
      const status = await ragService.getStatus();
      return res.json({ indexing, status });
    } catch (error: any) {
      return res.status(500).json({
        error: "Failed to rebuild index",
        details: error?.message || String(error),
      });
    }
  });

  // Direct retrieval API for debugging and smoke tests.
  app.post("/api/rag/search", async (req, res) => {
    const query = String(req.body?.query || "").trim();
    const topK = Math.max(1, Math.min(10, Number(req.body?.topK || process.env.RAG_TOP_K || 4)));

    if (!query) {
      return res.status(400).json({
        error: "query is required",
      });
    }

    try {
      const results = (await ragService.search(query, topK)).filter((item) => item.score >= ragMinScore);
      return res.json({ query, topK, minScore: ragMinScore, results });
    } catch (error: any) {
      return res.status(500).json({
        error: "Search failed",
        details: error?.message || String(error),
      });
    }
  });

  // Ollama proxy route
  app.post("/api/ollama/chat", async (req, res) => {
    const { model, messages, stream, options } = req.body as any;

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
      const respData = normalizeOllamaResponse(response.data as any);
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

  // RAG grounded chat route with source references.
  app.post("/api/rag/chat", async (req, res) => {
    const { model, messages, stream, options } = req.body as any;
    const topK = Math.max(1, Math.min(10, Number(req.body?.topK || process.env.RAG_TOP_K || 4)));

    const safeMessages = Array.isArray(messages) ? messages : [];
    const latestUserMessage = [...safeMessages]
      .reverse()
      .find((msg: any) => msg?.role === "user" && typeof msg?.content === "string");
    const query = String(latestUserMessage?.content || "").trim();

    try {
      const ragSources = query
        ? (await ragService.search(query, topK)).filter((item) => item.score >= ragMinScore)
        : [];
      const ragPrompt = ragService.buildGroundingPrompt(ragSources);

      const payload: any = {
        model: model || "qwen3:8b",
        messages: [
          {
            role: "system",
            content: ragPrompt,
          },
          ...safeMessages,
        ],
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
          res.setHeader("Content-Type", response.headers["content-type"] || "application/x-ndjson");
          res.write(`${JSON.stringify({ rag_sources: ragSources })}\n`);

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
            console.error("Stream error from Ollama (RAG):", err);
            try {
              res.end();
            } catch {}
            currentOllamaController = null;
            currentOllamaResponse = null;
          });
        } catch (err: any) {
          console.error("Error proxying RAG stream to Ollama:", err?.message || err);
          try {
            res.end();
          } catch {}
          currentOllamaController = null;
          currentOllamaResponse = null;
        }

        return;
      }

      const response = await axios.post(`${ollamaUrl}/api/chat`, payload, { responseType: "json" });
      const respData = normalizeOllamaResponse(response.data as any);
      return res.json({ ...respData, ragSources });
    } catch (error: any) {
      console.error("RAG chat error:", error?.message || error);
      if (!res.headersSent) {
        return res.status(502).json({
          error: "Failed to run RAG chat",
          details: error?.message || String(error),
          hint: "Ensure Ollama is running and index documents via /api/rag/import first.",
        });
      }
      try {
        res.end();
      } catch {}
      return;
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

  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.type === "entity.too.large") {
      return res.status(413).json({
        error: "Payload too large",
        details: "Request body exceeds server limit (25mb)",
        hint: "Use a smaller image, fewer images, or reduce image quality before upload.",
      });
    }
    return next(err);
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();