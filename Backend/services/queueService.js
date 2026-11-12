import { createRequire } from "module";
import { logTelemetry } from "./streamService.js";

const require = createRequire(import.meta.url);
const { Queue, Worker, QueueEvents } = require("bullmq");
const Redis = require("ioredis");
const pdfParse = require("pdf-parse");

/**
 * OPTION B: Memory-Optimized BullMQ Background Queue
 * Engineered strictly for 30MB Redis environments.
 * - Completed jobs are purged (retaining at most 20 metadata entries).
 * - Failed jobs are pruned automatically.
 * - Raw files are NEVER stored in Redis permanently; only sanitized extracted text.
 */

const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || "redis://localhost:6379";

export const queueConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  enableReadyCheck: false,
});

queueConnection.on("error", (err) => {
  console.warn("[BullMQ] Redis connection note:", err.message);
});

// Queue definition with auto-eviction policy to protect 30MB Redis limit
export const documentQueue = new Queue("document-processing", {
  connection: queueConnection,
  defaultJobOptions: {
    removeOnComplete: {
      count: 20,
      age: 1800, // 30 minutes
    },
    removeOnFail: {
      count: 50,
      age: 86400, // 24 hours
    },
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 1500,
    },
  },
});

export const queueEvents = new QueueEvents("document-processing", {
  connection: queueConnection,
});

/**
 * Worker to process heavy PDF & document parsing asynchronously in background
 */
export const documentWorker = new Worker(
  "document-processing",
  async (job) => {
    const { fileBufferBase64, fileName, mimeType, userId } = job.data;
    const fileBuffer = Buffer.from(fileBufferBase64, "base64");

    let extractedText = "";

    if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
      const pdfData = await pdfParse(fileBuffer);
      extractedText = (pdfData.text || "").trim();
    } else {
      // Plain text, markdown, json, or csv
      extractedText = fileBuffer.toString("utf-8").trim();
    }

    // Sanitize and cap context length to 15,000 characters to fit LLM prompt window and conserve memory
    const maxChars = 15000;
    const truncated = extractedText.length > maxChars;
    const cleanText = extractedText.slice(0, maxChars);

    // Log telemetry event to Redis Stream (Option A integration)
    await logTelemetry("document_parsed", {
      fileName,
      userId,
      charCount: cleanText.length,
      truncated,
    });

    return {
      fileName,
      charCount: cleanText.length,
      truncated,
      snippet: cleanText.slice(0, 300),
      cleanText,
    };
  },
  {
    connection: queueConnection,
    concurrency: 2, // Limit concurrent workers to prevent CPU spikes on Render
  }
);

documentWorker.on("completed", (job) => {
  console.log(`[BullMQ Worker] Job ${job.id} (${job.data.fileName}) completed.`);
});

documentWorker.on("failed", (job, err) => {
  console.warn(`[BullMQ Worker] Job ${job?.id} failed:`, err.message);
});

/**
 * Helper to dispatch document job and wait for completed text extraction
 */
export const processDocumentJob = async ({ fileBuffer, fileName, mimeType, userId }) => {
  const job = await documentQueue.add("parse-document", {
    fileBufferBase64: fileBuffer.toString("base64"),
    fileName,
    mimeType,
    userId,
  });

  const result = await job.waitUntilFinished(queueEvents, 20000); // 20s timeout
  return result;
};
