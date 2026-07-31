import { Client } from "basic-ftp";
import { Readable } from "stream";
import fs from "fs";
import path from "path";

const FTP_WEB_ROOT = process.env.FTP_WEB_ROOT || "httpdocs";
const RECORDINGS_FOLDER = process.env.RECORDINGS_FOLDER || "recordings";
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

/**
 * Reduce an untrusted value to a single safe path segment. Strips any directory
 * component, rejects traversal / NUL / separators, and allow-lists the charset.
 * Used on user/conversation ids that flow into FTP + local file paths, to
 * prevent path traversal and writes outside the intended folder (web-root RCE).
 */
export function sanitizePathSegment(input: unknown, label = "path segment"): string {
  const base = String(input ?? "").trim().replace(/^.*[\\/]/, "");
  if (!base || base === "." || base === ".." || base.includes("\0") || !/^[A-Za-z0-9._-]+$/.test(base)) {
    throw new Error(`Invalid ${label}`);
  }
  return base;
}

/**
 * Reduce an untrusted upload filename to a safe basename (no directories, no
 * traversal). Illegal characters are replaced; empty results get a timestamp.
 */
export function sanitizeStoredFileName(name: unknown, fallbackExt = "webm"): string {
  const base = String(name ?? "").replace(/^.*[\\/]/, "").trim().replace(/\0/g, "");
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_");
  if (!cleaned || cleaned === "." || cleaned === "..") {
    return `${Date.now()}.${fallbackExt}`;
  }
  return cleaned;
}

/**
 * Saves a file to the uploads folder and returns the URL of the saved file.
 * If the uploads folder does not exist, it will be created.
 * @param {ArrayBuffer} fileBuffer The file to be saved.
 * @param {string} fileName The name of the file.
 * @returns {Promise<string>} The URL of the saved file.
 * @throws {Error} If the file upload fails.
 */
export const saveFile = async (fileBuffer: ArrayBuffer, fileName: string) => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const filePath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(filePath, Buffer.from(fileBuffer));

    return `/uploads/${fileName}`;
  } catch (error) {
    throw new Error("File upload failed.");
  }
};

/**
 * Saves a file to the FTP server and returns the relative path of the saved file.
 * Falls back to local storage if FTP is not configured.
 * @param {ArrayBuffer} fileBuffer The file to be saved.
 * @param {string} fileName The name of the file.
 * @param {string} relativeFolder The relative path to the folder where the file should be saved.
 * @returns {Promise<string>} The relative path of the saved file.
 * @throws {Error} If the file upload fails.
 */
export const saveFileToFtp = async (
  fileBuffer: ArrayBuffer,
  fileName: string,
  relativeFolder: string
): Promise<string> => {
  const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_SECURE } = process.env;

  // The filename may be attacker-influenced; reduce to a safe basename. The
  // folder is server-composed but reject traversal defensively.
  const safeFileName = sanitizeStoredFileName(fileName);
  if (relativeFolder.includes("..") || relativeFolder.includes("\0") || relativeFolder.includes("\\")) {
    throw new Error("Invalid storage folder");
  }

  // Fallback to local storage if FTP is not configured
  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
    console.warn(
      "⚠️  FTP not configured, using local file storage for development"
    );
    const localDir = path.join(UPLOADS_DIR, relativeFolder);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const filePath = path.join(localDir, safeFileName);
    fs.writeFileSync(filePath, Buffer.from(fileBuffer));
    return `${relativeFolder}/${safeFileName}`;
  }

  const client = new Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: FTP_SECURE === "true",
    });

    client.ftp.socket.setTimeout(300000);

    const fullFolder = `${FTP_WEB_ROOT}/${relativeFolder}`;
    const parts = fullFolder.split("/");

    for (const part of parts) {
      if (part) {
        try {
          await client.cd(part);
        } catch {
          await client.send("MKD " + part);
          await client.cd(part);
        }
      }
    }

    const stream = Readable.from(Buffer.from(fileBuffer));
    await client.uploadFrom(stream, safeFileName);

    return `${relativeFolder}/${safeFileName}`; // Return relative path for DB
  } catch (error) {
    console.error("FTP upload error:", error);
    throw new Error("File upload failed.");
  } finally {
    client.close();
  }
};

/**
 * Saves a file to the FTP server from a local file path using streaming (memory-safe for large files).
 * Falls back to local storage if FTP is not configured.
 * @param {string} localFilePath The path to the local file.
 * @param {string} fileName The name for the file on FTP.
 * @param {string} relativeFolder The relative path to the folder where the file should be saved.
 * @returns {Promise<string>} The relative path of the saved file.
 * @throws {Error} If the file upload fails.
 */
export const saveFileToFtpFromPath = async (
  localFilePath: string,
  fileName: string,
  relativeFolder: string
): Promise<string> => {
  const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_SECURE } = process.env;

  // Fallback to local storage if FTP is not configured
  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
    console.warn(
      "⚠️  FTP not configured, using local file storage for development"
    );
    const localDir = path.join(UPLOADS_DIR, relativeFolder);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const destPath = path.join(localDir, fileName);
    fs.copyFileSync(localFilePath, destPath);
    return `${relativeFolder}/${fileName}`;
  }

  const client = new Client();
  client.ftp.verbose = false;

  try {
    // Get file size for progress logging
    const fileStats = fs.statSync(localFilePath);
    const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
    console.log(`[FTP Upload] Starting: ${fileName} (${fileSizeMB}MB)`);

    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: FTP_SECURE === "true",
    });

    client.ftp.socket.setTimeout(300000);

    const fullFolder = `${FTP_WEB_ROOT}/${relativeFolder}`;
    const parts = fullFolder.split("/");

    for (const part of parts) {
      if (part) {
        try {
          await client.cd(part);
        } catch {
          await client.send("MKD " + part);
          await client.cd(part);
        }
      }
    }

    // Use streaming upload to avoid loading entire file into memory
    // This is memory-efficient for large files
    const readStream = fs.createReadStream(localFilePath, {
      highWaterMark: 1024 * 1024, // Read in 1MB chunks
    });

    await client.uploadFrom(readStream, fileName);

    console.log(`[FTP Upload] Complete: ${fileName}`);

    return `${relativeFolder}/${fileName}`;
  } catch (error) {
    console.error("FTP upload error:", error);
    throw new Error("File upload failed.");
  } finally {
    client.close();
  }
};

/**
 * Deletes a file from the FTP server.
 * @param {string} relativePath - The relative path to the file, relative to the FTP web root.
 * @returns {Promise<void>}
 */
export const deleteFile = async (relativePath: string) => {
  if (relativePath.includes("..") || relativePath.includes("\0")) {
    throw new Error("Invalid file path");
  }
  const client = new Client();
  client.ftp.verbose = false;

  const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_SECURE } = process.env;

  try {
    await client.access({
      host: FTP_HOST!,
      user: FTP_USER!,
      password: FTP_PASSWORD!,
      secure: FTP_SECURE === "true",
    });

    client.ftp.socket.setTimeout(300000);

    const fullPath = `${FTP_WEB_ROOT}/${relativePath}`;
    await client.remove(fullPath);
  } catch (error: any) {
    console.warn("Failed to delete file:", relativePath, error?.message);
  } finally {
    client.close();
  }
};

export const deleteDirectory = async (relativePath: string) => {
  if (relativePath.includes("..") || relativePath.includes("\0")) {
    throw new Error("Invalid directory path");
  }
  const client = new Client();
  client.ftp.verbose = false;

  const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_SECURE } = process.env;

  try {
    await client.access({
      host: FTP_HOST!,
      user: FTP_USER!,
      password: FTP_PASSWORD!,
      secure: FTP_SECURE === "true",
    });

    client.ftp.socket.setTimeout(300000);

    const fullPath = `${FTP_WEB_ROOT}/${relativePath}`;
    await client.removeDir(fullPath);
  } catch (error: any) {
    console.warn("Failed to delete directory:", relativePath, error?.message);
  } finally {
    client.close();
  }
};

/**
 * Checks if a file exists at the specified path.
 * Falls back to local storage check if FTP is not configured.
 * @param {string} folderPath The relative folder path.
 * @param {string} fileName The name of the file.
 * @returns {Promise<boolean>} True if file exists, false otherwise.
 */
export const hasFilePath = async (
  folderPath: string,
  fileName: string
): Promise<boolean> => {
  const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_SECURE } = process.env;

  // Fallback to local storage check if FTP not configured
  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
    const localPath = path.join(UPLOADS_DIR, folderPath, fileName);
    return fs.existsSync(localPath);
  }

  const client = new Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: FTP_SECURE === "true",
    });

    const fullPath = `${FTP_WEB_ROOT}/${folderPath}/${fileName}`;
    const fileSize = await client.size(fullPath);
    return fileSize >= 0;
  } catch {
    return false;
  } finally {
    client.close();
  }
};

/**
 * Generates a relative upload path for user files based on the current date.
 * The path will be in the format `users/YYYY/MM`.
 * @returns {string} The generated upload path.
 */
export const generateUserUploadPath = (videoId: string) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `users/${year}/${month}`;
};

export const generateVideoUploadPath = (videoId: string) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `videos/${year}/${month}/${videoId}`;
};

export const generateUserAudioUploadPath = (userId: string) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `users/${year}/${month}/audio-uploads/${userId}`;
};

/**
 * Saves an audio chunk to the FTP server in the temp folder.
 * @param {Buffer} fileBuffer The audio chunk to be saved.
 * @param {string} fileName The name of the file.
 * @param {string} userId The user ID for folder structure.
 * @param {string} conversationId The conversation ID for folder structure.
 * @returns {Promise<string>} The relative path of the saved file.
 * @throws {Error} If the file upload fails.
 */
export const saveAudioChunkToFtp = async (
  fileBuffer: Buffer,
  fileName: string,
  userId: string,
  conversationId: string
): Promise<string> => {
  const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_SECURE, RECORDINGS_FOLDER } =
    process.env;

  // Harden every attacker-influenced segment before it becomes an FTP path:
  // conversationId + filename come from the client, userId from the JWT.
  const safeUserId = sanitizePathSegment(userId, "userId");
  const safeConversationId = sanitizePathSegment(conversationId, "conversationId");
  const safeFileName = sanitizeStoredFileName(fileName, "webm");

  const client = new Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: FTP_HOST!,
      user: FTP_USER!,
      password: FTP_PASSWORD!,
      secure: FTP_SECURE === "true",
    });

    client.ftp.socket.setTimeout(300000);

    const relativeFolder = `${RECORDINGS_FOLDER}/${safeUserId}/${safeConversationId}`;
    const fullFolder = `${FTP_WEB_ROOT}/${relativeFolder}`;
    const parts = fullFolder.split("/");

    for (const part of parts) {
      if (part) {
        try {
          await client.cd(part);
        } catch {
          await client.send("MKD " + part);
          await client.cd(part);
        }
      }
    }

    const stream = Readable.from(fileBuffer);
    await client.uploadFrom(stream, safeFileName);

    return `${relativeFolder}/${safeFileName}`;
  } catch (error) {
    console.error("FTP upload error:", error);
    throw new Error("Audio chunk upload failed.");
  } finally {
    client.close();
  }
};

export async function downloadFileFromFtp(filePath: string): Promise<Buffer> {
  if (filePath.includes("..") || filePath.includes("\0")) {
    throw new Error("Invalid file path");
  }
  const client = new Client();
  try {
    const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_SECURE } = process.env;

    if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
      throw new Error("Missing FTP configuration");
    }

    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: FTP_SECURE === "true",
    });

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const remotePath = filePath.startsWith(FTP_WEB_ROOT)
      ? filePath
      : [FTP_WEB_ROOT, filePath].filter(Boolean).join("/").replace(/\/+/g, "/");

    const tempFilePath = path.join(UPLOADS_DIR, `temp-${Date.now()}`);
    
    try {
      await client.downloadTo(tempFilePath, remotePath);
    } catch (downloadError) {
      throw new Error(`FTP download failed for ${remotePath}: ${downloadError instanceof Error ? downloadError.message : downloadError}`);
    }

    // Check if file was actually created
    if (!fs.existsSync(tempFilePath)) {
      throw new Error(`FTP download did not create file for: ${remotePath}`);
    }

    const buffer = fs.readFileSync(tempFilePath);
    fs.unlinkSync(tempFilePath);
    return buffer;
  } finally {
    client.close();
  }
}

/**
 * Lists all audio chunks in a conversation folder from FTP.
 * @param {string} userId The user ID.
 * @param {string} conversationId The conversation ID.
 * @returns {Promise<string[]>} Array of filenames in the folder.
 * @throws {Error} If listing fails.
 */
export async function listAudioChunks(
  userIdRaw: string,
  conversationIdRaw: string
): Promise<string[]> {
  const userId = sanitizePathSegment(userIdRaw, "userId");
  const conversationId = sanitizePathSegment(conversationIdRaw, "conversationId");
  const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_SECURE, RECORDINGS_FOLDER } =
    process.env;

  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
    throw new Error("Missing FTP configuration");
  }

  const client = new Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: FTP_SECURE === "true",
    });

    client.ftp.socket.setTimeout(300000);

    const relativeFolder = `${RECORDINGS_FOLDER}/${userId}/${conversationId}`;
    const fullFolder = `${FTP_WEB_ROOT}/${relativeFolder}`;

    try {
      const fileList = await client.list(fullFolder);
      return fileList
        .filter((file) => file.type === 1 && file.name.endsWith(".webm"))
        .map((file) => file.name);
    } catch (error: any) {
      // Folder doesn't exist
      if (error.code === 550 || error.message?.includes("No such file")) {
        return [];
      }
      throw error;
    }
  } catch (error) {
    console.error("FTP list error:", error);
    throw new Error("Failed to list audio chunks.");
  } finally {
    client.close();
  }
}

/**
 * Deletes all audio chunks for a conversation from the FTP server.
 * @param {string} userId The user ID.
 * @param {string} conversationId The conversation ID.
 * @returns {Promise<void>}
 * @throws {Error} If deletion fails.
 */
export async function deleteConversationChunks(
  userIdRaw: string,
  conversationIdRaw: string
): Promise<void> {
  const userId = sanitizePathSegment(userIdRaw, "userId");
  const conversationId = sanitizePathSegment(conversationIdRaw, "conversationId");
  try {
    // List all chunks in the conversation folder
    const chunkFilenames = await listAudioChunks(userId, conversationId);

    if (chunkFilenames.length === 0) {
      console.log(
        `[DeleteChunks] No chunks found for conversation ${conversationId}`
      );
      return;
    }

    console.log(
      `[DeleteChunks] Deleting ${chunkFilenames.length} chunks for conversation ${conversationId}`
    );

    // Delete each chunk file
    for (const filename of chunkFilenames) {
      const filePath = `${RECORDINGS_FOLDER}/${userId}/${conversationId}/${filename}`;
      await deleteFile(filePath);
    }

    console.log(
      `[DeleteChunks] Successfully deleted all chunks for conversation ${conversationId}`
    );
  } catch (error) {
    console.error("[DeleteChunks] Error:", error);
    throw new Error("Failed to delete conversation chunks.");
  }
}

export async function deleteConversationDirectory(
  userIdRaw: string,
  conversationIdRaw: string
): Promise<void> {
  const userId = sanitizePathSegment(userIdRaw, "userId");
  const conversationId = sanitizePathSegment(conversationIdRaw, "conversationId");
  try {
    console.log(`[DeleteConversation] Deleting conversation ${conversationId}`);

    const filePath = `${RECORDINGS_FOLDER}/${userId}/${conversationId}`;
    await deleteDirectory(filePath);
    console.log(
      `[DeleteConversation] Successfully deleted conversation ${conversationId}`
    );
  } catch (error) {
    console.error("[DeleteConversation] Error:", error);
    throw new Error("Failed to delete conversation.");
  }
}
