import path from "path";
import { logSecurityEvent } from "./streamService.js";

/**
 * File Security Service
 * Defensive validation layer against:
 * - Archive / Zip bombs (PK Zip, 42.zip, GZIP, 7-Zip, RAR, BZIP2, XZ, TAR)
 * - Executable binaries & shellcode (Windows PE/MZ, Linux ELF, Mach-O, scripts, shebangs)
 * - Web shells & polyglot file attacks (PHP/ASP/JS embedded inside image comments/metadata)
 * - Pixel Flood / Image decompression bombs (PNG, JPEG, WebP dimension guards)
 * - Weaponized PDF exploits (/JavaScript, /Launch, /EmbeddedFiles, /SubmitForm, /XFA)
 * - Path traversal, null byte injections, and double extension spoofing
 */

export class FileSecurityError extends Error {
  constructor(message, riskCategory = "MALWARE_RISK", statusCode = 400) {
    super(message);
    this.name = "FileSecurityError";
    this.isSecurityError = true;
    this.riskCategory = riskCategory;
    this.statusCode = statusCode;
  }
}

// Maximum limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_IMAGE_WIDTH = 4096;
const MAX_IMAGE_HEIGHT = 4096;
const MAX_TOTAL_PIXELS = 16777216; // 16 Megapixels

/**
 * Validates and sanitizes the uploaded file name against path traversal,
 * null bytes, and dangerous double extensions.
 */
export const sanitizeFileName = (rawName) => {
  if (!rawName || typeof rawName !== "string") {
    throw new FileSecurityError("Invalid or missing file name", "MALFORMED_INPUT", 400);
  }

  // 1. Disallow null bytes and control characters
  if (/[\x00-\x1f\x7f]/.test(rawName)) {
    throw new FileSecurityError(
      "Null bytes or control characters detected in file name",
      "TRAVERSAL_ATTACK",
      400
    );
  }

  // 2. Disallow directory traversal sequences
  if (rawName.includes("..") || rawName.includes("/") || rawName.includes("\\")) {
    throw new FileSecurityError(
      "Path traversal sequence detected in file name",
      "TRAVERSAL_ATTACK",
      400
    );
  }

  // 3. Disallow dangerous double extensions (e.g. invoice.php.png or script.exe.pdf)
  const doubleExtRegex = /\.(php[0-9]?|phtml|phar|exe|dll|sh|bash|bat|cmd|vbs|ps1|jsp|asp|aspx|cgi|jar|wasm|py|rb|pl)\.[a-z0-9]+$/i;
  if (doubleExtRegex.test(rawName)) {
    throw new FileSecurityError(
      "Dangerous double extension pattern detected",
      "EXECUTABLE_MASKING",
      400
    );
  }

  const baseName = path.basename(rawName).trim();
  const ext = path.extname(baseName).toLowerCase();

  // Strip unsafe characters from the base name, keep alphanumeric, dot, dash, underscore
  const safeName = baseName
    .replace(/[^a-zA-Z0-9.\-_]/g, "_")
    .slice(0, 100);

  if (!safeName || !ext) {
    throw new FileSecurityError("File name must include a valid extension", "MALFORMED_INPUT", 400);
  }

  return { safeName, ext };
};

/**
 * Detects archive and compressed file signatures to prevent zip bombs,
 * gzip bombs, tar bombs, and recursive archives.
 */
export const detectArchiveOrZipBomb = (buffer) => {
  if (buffer.length < 4) return false;

  // PK Zip signature (ZIP, 42.zip, JAR, APK, DOCX/XLSX bombs)
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4B &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
  ) {
    return { detected: true, format: "ZIP_ARCHIVE" };
  }

  // GZIP signature (1F 8B)
  if (buffer[0] === 0x1F && buffer[1] === 0x8B) {
    return { detected: true, format: "GZIP_STREAM" };
  }

  // 7-Zip signature (37 7A BC AF 27 1C)
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x37 &&
    buffer[1] === 0x7A &&
    buffer[2] === 0xBC &&
    buffer[3] === 0xAF &&
    buffer[4] === 0x27 &&
    buffer[5] === 0x1C
  ) {
    return { detected: true, format: "7ZIP_ARCHIVE" };
  }

  // RAR signature (52 61 72 21 1A 07)
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x61 &&
    buffer[2] === 0x72 &&
    buffer[3] === 0x21 &&
    buffer[4] === 0x1A &&
    buffer[5] === 0x07
  ) {
    return { detected: true, format: "RAR_ARCHIVE" };
  }

  // BZIP2 signature (42 5A 68)
  if (buffer[0] === 0x42 && buffer[1] === 0x5A && buffer[2] === 0x68) {
    return { detected: true, format: "BZIP2_ARCHIVE" };
  }

  // XZ signature (FD 37 7A 58 5A 00)
  if (
    buffer.length >= 6 &&
    buffer[0] === 0xFD &&
    buffer[1] === 0x37 &&
    buffer[2] === 0x7A &&
    buffer[3] === 0x58 &&
    buffer[4] === 0x5A &&
    buffer[5] === 0x00
  ) {
    return { detected: true, format: "XZ_ARCHIVE" };
  }

  // Zstandard signature (28 B5 2F FD)
  if (
    buffer[0] === 0x28 &&
    buffer[1] === 0xB5 &&
    buffer[2] === 0x2F &&
    buffer[3] === 0xFD
  ) {
    return { detected: true, format: "ZSTANDARD_STREAM" };
  }

  // TAR header signature (ustar at offset 257)
  if (buffer.length >= 262 && buffer.toString("ascii", 257, 262) === "ustar") {
    return { detected: true, format: "TAR_ARCHIVE" };
  }

  return { detected: false };
};

/**
 * Detects executable binaries, shared libraries, and shell scripts.
 */
export const detectExecutableOrBinary = (buffer) => {
  if (buffer.length < 4) return false;

  // Windows PE Executable / DLL (MZ at byte 0)
  if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
    return { detected: true, type: "WINDOWS_PE_EXECUTABLE" };
  }

  // Linux ELF Executable (\x7fELF)
  if (
    buffer[0] === 0x7F &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4C &&
    buffer[3] === 0x46
  ) {
    return { detected: true, type: "LINUX_ELF_BINARY" };
  }

  // macOS Mach-O Executable
  if (
    (buffer[0] === 0xFE && buffer[1] === 0xED && buffer[2] === 0xFA && buffer[3] === 0xCE) ||
    (buffer[0] === 0xFE && buffer[1] === 0xED && buffer[2] === 0xFA && buffer[3] === 0xCF) ||
    (buffer[0] === 0xCE && buffer[1] === 0xFA && buffer[2] === 0xED && buffer[3] === 0xFE) ||
    (buffer[0] === 0xCF && buffer[1] === 0xFA && buffer[2] === 0xED && buffer[3] === 0xFE)
  ) {
    return { detected: true, type: "MACOS_MACHO_BINARY" };
  }

  // Java Class bytecode / Mach-O Fat (CA FE BA BE)
  if (
    buffer[0] === 0xCA &&
    buffer[1] === 0xFE &&
    buffer[2] === 0xBA &&
    buffer[3] === 0xBE
  ) {
    return { detected: true, type: "JAVA_BYTECODE_OR_FAT_BINARY" };
  }

  // WebAssembly binary (\0asm)
  if (
    buffer[0] === 0x00 &&
    buffer[1] === 0x61 &&
    buffer[2] === 0x73 &&
    buffer[3] === 0x6D
  ) {
    return { detected: true, type: "WASM_BINARY" };
  }

  // Unix Script Shebang (#!)
  if (buffer[0] === 0x23 && buffer[1] === 0x21) {
    return { detected: true, type: "UNIX_SHEBANG_SCRIPT" };
  }

  return { detected: false };
};

/**
 * Scans buffer for polyglot web shells, embedded PHP, ASP, script injection,
 * and command execution keywords.
 */
export const detectWebshellOrPolyglot = (buffer) => {
  const sample = buffer.slice(0, Math.min(buffer.length, 256 * 1024)).toString("latin1");

  const dangerousPatterns = [
    { pattern: /<\?php\b/i, label: "PHP_TAG" },
    { pattern: /<\?=/i, label: "PHP_SHORT_ECHO" },
    { pattern: /<\%[\s=]/i, label: "ASP_JSP_TAG" },
    { pattern: /<script\b[^>]*>/i, label: "SCRIPT_TAG" },
    { pattern: /<svg\b[^>]*\bon\w+\s*=/i, label: "SVG_EVENT_INJECTION" },
    { pattern: /\b(eval|system|passthru|shell_exec|exec|base64_decode)\s*\(/i, label: "COMMAND_EXECUTION_CALL" },
    { pattern: /powershell\s+(?:-e|-enc|-encodedcommand)/i, label: "ENCODED_POWERSHELL" },
    { pattern: /\bcmd\.exe\b/i, label: "CMD_SPAWN" },
  ];

  for (const { pattern, label } of dangerousPatterns) {
    if (pattern.test(sample)) {
      return { detected: true, label };
    }
  }

  return { detected: false };
};

/**
 * Extracts dimensions for PNG images from IHDR chunk.
 */
const extractPngDimensions = (buffer) => {
  if (buffer.length < 24) return null;
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A;

  if (!isPng) return null;

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
};

/**
 * Extracts dimensions for JPEG images by walking SOF markers.
 */
const extractJpegDimensions = (buffer) => {
  if (buffer.length < 4) return null;
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) return null;

  let offset = 2;
  while (offset < buffer.length - 8) {
    if (buffer[offset] !== 0xFF) break;
    const marker = buffer[offset + 1];

    // SOF0 (Baseline), SOF1 (Extended), SOF2 (Progressive)
    if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }

    const len = buffer.readUInt16BE(offset + 2);
    offset += 2 + len;
  }

  return null;
};

/**
 * Extracts dimensions for WebP images (VP8, VP8L, VP8X chunks).
 */
const extractWebpDimensions = (buffer) => {
  if (buffer.length < 30) return null;
  const riff = buffer.toString("ascii", 0, 4);
  const webp = buffer.toString("ascii", 8, 12);
  if (riff !== "RIFF" || webp !== "WEBP") return null;

  const chunkType = buffer.toString("ascii", 12, 16);

  if (chunkType === "VP8X") {
    const width = 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16);
    const height = 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16);
    return { width, height };
  } else if (chunkType === "VP8 ") {
    if (buffer.length >= 30 && buffer[23] === 0x9D && buffer[24] === 0x01 && buffer[25] === 0x2A) {
      const width = buffer.readUInt16LE(26) & 0x3FFF;
      const height = buffer.readUInt16LE(28) & 0x3FFF;
      return { width, height };
    }
  } else if (chunkType === "VP8L") {
    if (buffer.length >= 25 && buffer[20] === 0x2F) {
      const b0 = buffer[21], b1 = buffer[22], b2 = buffer[23], b3 = buffer[24];
      const width = 1 + (((b1 & 0x3F) << 8) | b0);
      const height = 1 + (((b3 & 0xF) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
      return { width, height };
    }
  }

  return null;
};

/**
 * Validates image integrity, true magic bytes, dimension boundaries,
 * and scans for polyglot malware.
 */
export const validateImageSecurity = (buffer, ext) => {
  let dimensions = null;
  let detectedMime = null;

  if (ext === ".png") {
    dimensions = extractPngDimensions(buffer);
    detectedMime = "image/png";
  } else if (ext === ".jpg" || ext === ".jpeg") {
    dimensions = extractJpegDimensions(buffer);
    detectedMime = "image/jpeg";
  } else if (ext === ".webp") {
    dimensions = extractWebpDimensions(buffer);
    detectedMime = "image/webp";
  } else {
    throw new FileSecurityError(
      `Unsupported image extension: ${ext}`,
      "INVALID_MIME",
      400
    );
  }

  if (!dimensions) {
    throw new FileSecurityError(
      `File signature does not match image format ${ext}. Possible MIME spoofing or corrupted file.`,
      "MIME_SPOOFING",
      400
    );
  }

  const { width, height } = dimensions;

  // Pixel flood / Image decompression bomb guard
  if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT) {
    throw new FileSecurityError(
      `Image dimensions (${width}x${height}) exceed maximum allowed security limit of ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT}. Decompression bomb rejected.`,
      "PIXEL_FLOOD_BOMB",
      422
    );
  }

  const totalPixels = width * height;
  if (totalPixels > MAX_TOTAL_PIXELS) {
    throw new FileSecurityError(
      `Image pixel volume (${totalPixels.toLocaleString()} px) exceeds maximum safe threshold. Decompression bomb rejected.`,
      "PIXEL_FLOOD_BOMB",
      422
    );
  }

  // Scan image stream for hidden polyglot web shells or embedded script tags
  const polyglot = detectWebshellOrPolyglot(buffer);
  if (polyglot.detected) {
    throw new FileSecurityError(
      `Polyglot attack detected: Image contains embedded executable script payloads (${polyglot.label}).`,
      "POLYGLOT_MALWARE",
      422
    );
  }

  return {
    valid: true,
    fileType: "image",
    detectedMimeType: detectedMime,
    dimensions: { width, height },
  };
};

/**
 * Validates PDF magic bytes and scans for weaponized PDF attack vectors.
 */
export const validatePdfSecurity = (buffer) => {
  // Check magic bytes: %PDF- (25 50 44 46 2D)
  const isPdf =
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2D;

  if (!isPdf) {
    throw new FileSecurityError(
      "File extension is .pdf but binary content does not start with valid PDF magic bytes (%PDF-).",
      "MIME_SPOOFING",
      400
    );
  }

  // Scan PDF structure for dangerous exploit tokens
  const sample = buffer.toString("latin1");

  const dangerousPdfTokens = [
    { regex: /\/JavaScript\b/i, label: "PDF_EMBEDDED_JAVASCRIPT" },
    { regex: /\/JS\b/i, label: "PDF_JS_ACTION" },
    { regex: /\/Launch\b/i, label: "PDF_LAUNCH_EXTERNAL_PROCESS" },
    { regex: /\/EmbeddedFiles\b/i, label: "PDF_EMBEDDED_BINARY_FILES" },
    { regex: /\/SubmitForm\b/i, label: "PDF_FORM_EXFILTRATION" },
    { regex: /\/ImportData\b/i, label: "PDF_DATA_IMPORT_EXPLOIT" },
    { regex: /\/RichMedia\b/i, label: "PDF_FLASH_RICHMEDIA" },
  ];

  for (const { regex, label } of dangerousPdfTokens) {
    if (regex.test(sample)) {
      throw new FileSecurityError(
        `Weaponized PDF detected: Document contains dangerous active directive (${label}).`,
        "PDF_EXPLOIT_DIRECTIVE",
        422
      );
    }
  }

  return {
    valid: true,
    fileType: "pdf",
    detectedMimeType: "application/pdf",
  };
};

/**
 * Validates plain text documents (.txt, .md, .json, .csv) against binary injection
 * and prototype pollution.
 */
export const validateTextSecurity = (buffer, ext) => {
  // Check for binary null bytes. Legitimate UTF-8 text does not contain null bytes.
  const inspectLength = Math.min(buffer.length, 8192);
  for (let i = 0; i < inspectLength; i++) {
    if (buffer[i] === 0x00) {
      throw new FileSecurityError(
        "Binary null bytes detected in plain text file. Possible disguised executable or shellcode.",
        "BINARY_MASKING",
        400
      );
    }
  }

  const textContent = buffer.toString("utf-8");

  // JSON security validation
  if (ext === ".json") {
    try {
      const parsed = JSON.parse(textContent);
      // Prototype pollution check on keys
      const jsonStr = JSON.stringify(parsed);
      if (jsonStr.includes("__proto__") || jsonStr.includes("constructor") || jsonStr.includes("prototype")) {
        throw new FileSecurityError(
          "JSON payload contains prototype pollution property keys.",
          "PROTOTYPE_POLLUTION",
          400
        );
      }
    } catch (parseErr) {
      throw new FileSecurityError(
        `Invalid JSON content: ${parseErr.message}`,
        "MALFORMED_JSON",
        400
      );
    }
  }

  // Scan text for active web shell scripts
  const polyglot = detectWebshellOrPolyglot(buffer);
  if (polyglot.detected) {
    throw new FileSecurityError(
      `Suspicious executable script content detected in document (${polyglot.label}).`,
      "SCRIPT_INJECTION",
      400
    );
  }

  return {
    valid: true,
    fileType: "text",
    detectedMimeType: ext === ".json" ? "application/json" : "text/plain",
  };
};

/**
 * Master Inspection Entry Point
 * Orchestrates all defensive checks before any file reaches Redis or LLM.
 */
export const inspectUploadedFile = async (file, user = null) => {
  if (!file || !file.buffer) {
    throw new FileSecurityError("No file buffer provided for security inspection", "EMPTY_FILE", 400);
  }

  if (file.buffer.length === 0) {
    throw new FileSecurityError("Empty file (0 bytes) rejected", "EMPTY_FILE", 400);
  }

  if (file.buffer.length > MAX_FILE_SIZE) {
    throw new FileSecurityError(
      `File size (${(file.buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum limit of 10 MB`,
      "SIZE_EXCEEDED",
      400
    );
  }

  const { safeName, ext } = sanitizeFileName(file.originalname);
  const buffer = file.buffer;

  try {
    // 1. Anti-Zip / Archive Bomb Check
    const archiveCheck = detectArchiveOrZipBomb(buffer);
    if (archiveCheck.detected) {
      throw new FileSecurityError(
        `Archive file format detected (${archiveCheck.format}). Archives and compressed containers are strictly blocked to prevent decompression bombs.`,
        "ZIP_BOMB_CONTAINER",
        422
      );
    }

    // 2. Anti-Executable Binary Check
    const exeCheck = detectExecutableOrBinary(buffer);
    if (exeCheck.detected) {
      throw new FileSecurityError(
        `Executable binary format detected (${exeCheck.type}). Executables, libraries, and script binaries are strictly prohibited.`,
        "EXECUTABLE_BINARY",
        422
      );
    }

    // 3. Format-specific deep inspection
    let formatResult;
    const isImageExt = [".png", ".jpg", ".jpeg", ".webp"].includes(ext);
    const isPdfExt = ext === ".pdf";
    const isTextExt = [".txt", ".md", ".json", ".csv"].includes(ext);

    if (isImageExt) {
      formatResult = validateImageSecurity(buffer, ext);
    } else if (isPdfExt) {
      formatResult = validatePdfSecurity(buffer);
    } else if (isTextExt) {
      formatResult = validateTextSecurity(buffer, ext);
    } else {
      throw new FileSecurityError(
        `Unsupported file extension: ${ext}. Supported formats: PDF, TXT, MD, JSON, CSV, PNG, JPG, JPEG, WEBP.`,
        "UNSUPPORTED_EXTENSION",
        400
      );
    }

    return {
      valid: true,
      sanitizedName: safeName,
      ext,
      fileType: formatResult.fileType,
      detectedMimeType: formatResult.detectedMimeType,
      imageMetadata: formatResult.dimensions || null,
      size: buffer.length,
    };
  } catch (err) {
    // Publish security incident to Option A Redis Stream for live monitoring
    await logSecurityEvent("file_upload_blocked", {
      reason: err.message,
      riskCategory: err.riskCategory || "UNKNOWN_THREAT",
      fileName: safeName,
      userId: user?._id?.toString() || "anonymous",
      fileSize: buffer.length,
    });

    throw err;
  }
};
