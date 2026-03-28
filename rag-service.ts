import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

export type RagSource = {
  fileName: string;
  snippet: string;
  score: number;
  chunkId: string;
};

type RagDocument = {
  id: string;
  fileName: string;
  fileType: "pdf" | "markdown" | "text";
  addedAt: number;
  updatedAt: number;
};

export type RagDocumentSummary = {
  id: string;
  fileName: string;
  fileType: "pdf" | "markdown" | "text";
  addedAt: number;
  updatedAt: number;
  chunkCount: number;
};

type RagChunk = {
  id: string;
  documentId: string;
  fileName: string;
  text: string;
  embedding?: number[];
};

type RagIndexData = {
  version: number;
  chunkSize: number;
  chunkOverlap: number;
  embeddingDim: number;
  documents: RagDocument[];
  chunks: RagChunk[];
  updatedAt: number;
};

type ImportedFile = {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
};

type RagServiceOptions = {
  baseDir: string;
  chunkSize: number;
  chunkOverlap: number;
  embeddingDim: number;
};

const DEFAULT_INDEX: RagIndexData = {
  version: 1,
  chunkSize: 900,
  chunkOverlap: 150,
  embeddingDim: 256,
  documents: [],
  chunks: [],
  updatedAt: Date.now(),
};

const normalizeText = (input: string) =>
  input
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\t\f\v ]+/g, " ")
    .trim();

const inferFileType = (fileName: string, mimeType: string): RagDocument["fileType"] => {
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType.toLowerCase();
  if (lowerName.endsWith(".pdf") || lowerMime.includes("pdf")) return "pdf";
  if (
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".markdown") ||
    lowerMime.includes("markdown")
  ) {
    return "markdown";
  }
  return "text";
};

const splitIntoChunks = (text: string, chunkSize: number, chunkOverlap: number) => {
  const chunks: string[] = [];
  const clean = normalizeText(text);
  if (!clean) return chunks;
  if (clean.length <= chunkSize) return [clean];

  let start = 0;
  while (start < clean.length) {
    const end = Math.min(clean.length, start + chunkSize);
    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;
    start = Math.max(end - chunkOverlap, start + 1);
  }

  return chunks;
};

const hashToIndex = (token: string, dim: number) => {
  const hex = crypto.createHash("sha1").update(token).digest("hex").slice(0, 8);
  return parseInt(hex, 16) % dim;
};

const l2Normalize = (vec: number[]) => {
  const norm = Math.sqrt(vec.reduce((sum, item) => sum + item * item, 0));
  if (!norm) return vec;
  return vec.map((item) => item / norm);
};

const embedTextOffline = (text: string, dim: number) => {
  const vec = new Array<number>(dim).fill(0);
  const tokens = normalizeText(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .filter(Boolean);

  for (const token of tokens) {
    const idx = hashToIndex(token, dim);
    vec[idx] += 1;

    if (token.length >= 3) {
      for (let i = 0; i <= token.length - 3; i += 1) {
        const trigram = token.slice(i, i + 3);
        const triIdx = hashToIndex(`tri:${trigram}`, dim);
        vec[triIdx] += 0.3;
      }
    }
  }

  return l2Normalize(vec);
};

const cosineSimilarity = (a: number[], b: number[]) => {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
};

const buildSnippet = (text: string, maxLength = 220) => {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLength) return oneLine;
  return `${oneLine.slice(0, maxLength - 1)}...`;
};

const shouldInsertSpace = (previousText: string, nextText: string) => {
  const prevChar = previousText.slice(-1);
  const nextChar = nextText.slice(0, 1);
  return /[A-Za-z0-9]$/.test(prevChar) && /^[A-Za-z0-9]/.test(nextChar);
};

const extractPdfTextWithPdfJs = async (buffer: Buffer) => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const cmapsUrl = pathToFileURL(path.resolve(process.cwd(), "node_modules", "pdfjs-dist", "cmaps") + path.sep).href;
  const standardFontsUrl = pathToFileURL(
    path.resolve(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts") + path.sep
  ).href;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    cMapUrl: cmapsUrl,
    cMapPacked: true,
    standardFontDataUrl: standardFontsUrl,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  });

  const pdfDocument = await loadingTask.promise;
  try {
    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = "";
      for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
        const text = String(item?.str || "");
        if (!text) {
          if (item?.hasEOL) pageText += "\n";
          continue;
        }

        if (pageText && shouldInsertSpace(pageText, text)) {
          pageText += " ";
        }
        pageText += text;
        if (item?.hasEOL) {
          pageText += "\n";
        }
      }
      const normalized = normalizeText(pageText);
      if (normalized) {
        pageTexts.push(normalized);
      }
    }

    return normalizeText(pageTexts.join("\n\n"));
  } finally {
    await pdfDocument.destroy();
  }
};

export class RagService {
  private readonly baseDir: string;
  private readonly indexFilePath: string;
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;
  private readonly embeddingDim: number;

  constructor(opts: RagServiceOptions) {
    this.baseDir = opts.baseDir;
    this.indexFilePath = path.join(this.baseDir, "rag-index.json");
    this.chunkSize = opts.chunkSize;
    this.chunkOverlap = opts.chunkOverlap;
    this.embeddingDim = opts.embeddingDim;
  }

  private async ensureDataDir() {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  private async readIndex(): Promise<RagIndexData> {
    await this.ensureDataDir();
    try {
      const raw = await fs.readFile(this.indexFilePath, "utf-8");
      const parsed = JSON.parse(raw) as RagIndexData;
      return {
        ...DEFAULT_INDEX,
        ...parsed,
        chunkSize: this.chunkSize,
        chunkOverlap: this.chunkOverlap,
        embeddingDim: this.embeddingDim,
      };
    } catch {
      const fresh: RagIndexData = {
        ...DEFAULT_INDEX,
        chunkSize: this.chunkSize,
        chunkOverlap: this.chunkOverlap,
        embeddingDim: this.embeddingDim,
        updatedAt: Date.now(),
      };
      await this.writeIndex(fresh);
      return fresh;
    }
  }

  private async writeIndex(index: RagIndexData) {
    await this.ensureDataDir();
    const payload: RagIndexData = {
      ...index,
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
      embeddingDim: this.embeddingDim,
      updatedAt: Date.now(),
    };
    await fs.writeFile(this.indexFilePath, JSON.stringify(payload, null, 2), "utf-8");
  }

  private async extractText(file: ImportedFile): Promise<string> {
    const fileType = inferFileType(file.originalName, file.mimeType);
    if (fileType === "pdf") {
      return extractPdfTextWithPdfJs(file.buffer);
    }

    return normalizeText(file.buffer.toString("utf-8"));
  }

  async getStatus() {
    const index = await this.readIndex();
    const embeddedChunkCount = index.chunks.filter((chunk) => Array.isArray(chunk.embedding)).length;
    return {
      indexFilePath: this.indexFilePath,
      documents: index.documents.length,
      chunks: index.chunks.length,
      embeddedChunks: embeddedChunkCount,
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
      embeddingDim: this.embeddingDim,
      updatedAt: index.updatedAt,
    };
  }

  async listDocuments(): Promise<RagDocumentSummary[]> {
    const index = await this.readIndex();
    return index.documents
      .map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        addedAt: doc.addedAt,
        updatedAt: doc.updatedAt,
        chunkCount: index.chunks.filter((chunk) => chunk.documentId === doc.id).length,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async deleteDocument(documentId: string) {
    const index = await this.readIndex();
    const target = index.documents.find((doc) => doc.id === documentId);
    if (!target) {
      return {
        deleted: false,
        fileName: null,
        removedChunks: 0,
      };
    }

    const removedChunks = index.chunks.filter((chunk) => chunk.documentId === documentId).length;
    index.documents = index.documents.filter((doc) => doc.id !== documentId);
    index.chunks = index.chunks.filter((chunk) => chunk.documentId !== documentId);
    await this.writeIndex(index);

    return {
      deleted: true,
      fileName: target.fileName,
      removedChunks,
    };
  }

  async importDocuments(files: ImportedFile[]) {
    if (!files.length) {
      return {
        imported: 0,
        skipped: 0,
        errors: ["No files uploaded."],
      };
    }

    const index = await this.readIndex();
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const file of files) {
      try {
        const text = await this.extractText(file);
        if (!text) {
          skipped += 1;
          errors.push(`${file.originalName}: extracted text is empty.`);
          continue;
        }

        const chunks = splitIntoChunks(text, this.chunkSize, this.chunkOverlap);
        if (!chunks.length) {
          skipped += 1;
          errors.push(`${file.originalName}: no valid chunks produced.`);
          continue;
        }

        const existingDoc = index.documents.find((doc) => doc.fileName === file.originalName);
        const docId = existingDoc?.id || crypto.randomUUID();
        const fileType = inferFileType(file.originalName, file.mimeType);
        const now = Date.now();

        index.documents = index.documents.filter((doc) => doc.id !== docId);
        index.chunks = index.chunks.filter((chunk) => chunk.documentId !== docId);

        index.documents.push({
          id: docId,
          fileName: file.originalName,
          fileType,
          addedAt: existingDoc?.addedAt || now,
          updatedAt: now,
        });

        index.chunks.push(
          ...chunks.map((chunkText, idx) => ({
            id: `${docId}:${idx + 1}`,
            documentId: docId,
            fileName: file.originalName,
            text: chunkText,
          }))
        );

        imported += 1;
      } catch (error: any) {
        skipped += 1;
        errors.push(`${file.originalName}: ${error?.message || String(error)}`);
      }
    }

    await this.writeIndex(index);
    return {
      imported,
      skipped,
      errors,
    };
  }

  async reindex() {
    const index = await this.readIndex();
    for (const chunk of index.chunks) {
      chunk.embedding = embedTextOffline(chunk.text, this.embeddingDim);
    }
    await this.writeIndex(index);
    return {
      indexedChunks: index.chunks.length,
      embeddingDim: this.embeddingDim,
    };
  }

  async search(query: string, topK = 4): Promise<RagSource[]> {
    const cleanQuery = normalizeText(query);
    if (!cleanQuery) return [];

    const index = await this.readIndex();
    const embeddedChunks = index.chunks.filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length);
    if (!embeddedChunks.length) return [];

    const queryEmbedding = embedTextOffline(cleanQuery, this.embeddingDim);
    const scored = embeddedChunks
      .map((chunk) => ({
        chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding!),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(10, topK)));

    return scored.map(({ chunk, score }) => ({
      fileName: chunk.fileName,
      snippet: buildSnippet(chunk.text),
      score: Number(score.toFixed(4)),
      chunkId: chunk.id,
    }));
  }

  buildGroundingPrompt(results: RagSource[]) {
    if (!results.length) {
      return "未命中知识库内容。请直接基于你的通用能力回答，并明确说明未命中知识库。";
    }

    const blocks = results
      .map((item, idx) => {
        return `[#${idx + 1}] 文件: ${item.fileName}\n片段: ${item.snippet}`;
      })
      .join("\n\n");

    return [
      "你正在使用本地外挂知识库回答问题。",
      "优先依据以下知识片段作答；如果知识不足请明确指出。",
      "回答末尾附上【引用来源】小节，每条格式：- 文件名: 片段摘要。",
      "知识库命中内容如下:",
      blocks,
    ].join("\n\n");
  }
}
