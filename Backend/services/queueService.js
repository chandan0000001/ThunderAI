import { createRequire } from "module";
import { logTelemetry } from "./streamService.js";

const require = createRequire(import.meta.url);
const { Queue, Worker, QueueEvents } = require("bullmq");
const Redis = require("ioredis");
const { PDFParse } = require("pdf-parse");

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
    const { fileBufferBase64, fileName, mimeType, fileType, imageMetadata, userId } = job.data;

    let extractedText = "";

    if (fileType === "image") {
      const dims = imageMetadata ? `${imageMetadata.width}x${imageMetadata.height}` : "verified";
      const cleanText = `[Attached Image: ${fileName} (${mimeType}, dimensions: ${dims})]`;

      await logTelemetry("image_parsed", {
        fileName,
        userId,
        mimeType,
        dimensions: dims,
      });

      return {
        fileName,
        fileType: "image",
        charCount: cleanText.length,
        truncated: false,
        snippet: `[Image: ${fileName} (${dims})]`,
        cleanText,
        dimensions: imageMetadata,
      };
    }

    const fileBuffer = Buffer.from(fileBufferBase64, "base64");

    if (fileType === "pdf" || mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
      const parser = new PDFParse({ data: fileBuffer });
      const parsed = await Promise.race([
        parser.getText(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("PDF text extraction timeout")), 4000)
        ),
      ]);
      extractedText = (parsed?.text || "").trim();
      await parser.destroy();
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
      fileType: fileType || "text",
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
 * Helper to dispatch document job and wait for completed text extraction.
 * For images, we avoid sending raw image bytes to Redis to protect the 30MB limit.
 */
export const processDocumentJob = async ({
  fileBuffer,
  fileName,
  mimeType,
  fileType,
  imageMetadata,
  userId,
}) => {
  const jobPayload = {
    fileName,
    mimeType,
    fileType,
    imageMetadata,
    userId,
  };

  // Only attach binary base64 for non-image documents (PDF/TXT) needing worker parsing
  if (fileType !== "image" && fileBuffer) {
    jobPayload.fileBufferBase64 = fileBuffer.toString("base64");
  }

  const job = await documentQueue.add("parse-document", jobPayload);
  const result = await job.waitUntilFinished(queueEvents, 20000); // 20s timeout
  return result;
};
