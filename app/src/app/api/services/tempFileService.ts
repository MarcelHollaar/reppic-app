import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export class TempFileService {
  private static readonly TEMP_DIR = path.join(process.cwd(), 'temp', 'audio-processing');
  private static readonly CHUNK_DIR = path.join(process.cwd(), 'temp', 'chunks');
  private static readonly MAX_AGE_MS = 3600000; // 1 hour

  static async initialize(): Promise<void> {
    await mkdir(this.TEMP_DIR, { recursive: true });
    await mkdir(this.CHUNK_DIR, { recursive: true });
  }

  static async saveTempFile(buffer: Buffer, extension: string = 'mp3'): Promise<string> {
    await this.initialize();
    
    const filename = `${uuidv4()}.${extension}`;
    const filepath = path.join(this.TEMP_DIR, filename);
    
    await writeFile(filepath, buffer);
    
    return filepath;
  }

  static async saveChunk(
    conversationId: string,
    chunkIndex: number,
    buffer: Buffer
  ): Promise<string> {
    await this.initialize();
    
    const chunkDir = path.join(this.CHUNK_DIR, conversationId);
    await mkdir(chunkDir, { recursive: true });
    
    const filename = `chunk_${String(chunkIndex).padStart(5, '0')}.tmp`;
    const filepath = path.join(chunkDir, filename);
    
    await writeFile(filepath, buffer);
    
    return filepath;
  }

  static async saveChunkStream(
    conversationId: string,
    chunkIndex: number,
    readableStream: ReadableStream,
    expectedSize?: number
  ): Promise<string> {
    await this.initialize();
    
    const chunkDir = path.join(this.CHUNK_DIR, conversationId);
    await mkdir(chunkDir, { recursive: true });
    
    const filename = `chunk_${String(chunkIndex).padStart(5, '0')}.tmp`;
    const filepath = path.join(chunkDir, filename);
    const metadataPath = `${filepath}.meta`;
    
    const writeStream = fs.createWriteStream(filepath);
    const reader = readableStream.getReader();
    
    let writeError: Error | null = null;
    writeStream.on('error', (err) => {
      writeError = err;
    });
    
    try {
      while (true) {
        if (writeError) {
          throw writeError;
        }
        
        const { done, value } = await reader.read();
        if (done) break;
        
        const canWrite = writeStream.write(Buffer.from(value));
        if (!canWrite) {
          await new Promise<void>((resolve, reject) => {
            writeStream.once('drain', () => resolve());
            writeStream.once('error', reject);
          });
        }
      }
      
      if (writeError) {
        throw writeError;
      }
      
      const finishPromise = new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
      });
      
      writeStream.end();
      
      await finishPromise;
      
      if (expectedSize !== undefined && writeStream.bytesWritten !== expectedSize) {
        throw new Error(
          `Chunk ${chunkIndex} size mismatch: expected ${expectedSize} bytes, wrote ${writeStream.bytesWritten} bytes`
        );
      }
      
      if (expectedSize !== undefined) {
        await writeFile(metadataPath, JSON.stringify({ 
          chunkIndex, 
          expectedSize, 
          actualSize: writeStream.bytesWritten 
        }));
      }
      
      return filepath;
    } catch (error) {
      writeStream.destroy();
      
      if (fs.existsSync(filepath)) {
        try {
          await unlink(filepath);
        } catch (cleanupError) {
          console.error('[TempFileService] Failed to cleanup partial chunk:', filepath, cleanupError);
        }
      }
      
      if (fs.existsSync(metadataPath)) {
        try {
          await unlink(metadataPath);
        } catch (cleanupError) {
          console.error('[TempFileService] Failed to cleanup chunk metadata:', metadataPath, cleanupError);
        }
      }
      
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  static async assembleChunks(
    conversationId: string,
    totalChunks: number,
    outputExtension: string = 'mp3'
  ): Promise<string> {
    const chunkDir = path.join(this.CHUNK_DIR, conversationId);
    const filename = `${uuidv4()}.${outputExtension}`;
    const outputPath = path.join(this.TEMP_DIR, filename);
    
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk_${String(i).padStart(5, '0')}.tmp`);
      const metadataPath = `${chunkPath}.meta`;
      
      if (!fs.existsSync(chunkPath)) {
        throw new Error(`Missing chunk ${i} for conversation ${conversationId}`);
      }
      
      const chunkStats = await stat(chunkPath);
      if (chunkStats.size === 0) {
        throw new Error(`Corrupt chunk ${i} (0 bytes) for conversation ${conversationId}`);
      }
      
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        if (metadata.expectedSize && chunkStats.size !== metadata.expectedSize) {
          throw new Error(
            `Chunk ${i} size mismatch: expected ${metadata.expectedSize} bytes, found ${chunkStats.size} bytes`
          );
        }
      }
    }
    
    const writeStream = fs.createWriteStream(outputPath, { flags: 'w' });
    
    let writeError: Error | null = null;
    writeStream.on('error', (err) => {
      writeError = err;
    });
    
    try {
      for (let i = 0; i < totalChunks; i++) {
        if (writeError) {
          throw writeError;
        }
        
        const chunkPath = path.join(chunkDir, `chunk_${String(i).padStart(5, '0')}.tmp`);
        const readStream = fs.createReadStream(chunkPath);
        
        await new Promise<void>((resolve, reject) => {
          readStream.on('data', (chunk) => {
            if (writeError) {
              readStream.destroy();
              reject(writeError);
              return;
            }
            
            const canWrite = writeStream.write(chunk);
            if (!canWrite) {
              readStream.pause();
              
              const onDrain = () => {
                writeStream.off('error', onError);
                readStream.resume();
              };
              const onError = (err: Error) => {
                writeStream.off('drain', onDrain);
                readStream.destroy();
                reject(err);
              };
              
              writeStream.once('drain', onDrain);
              writeStream.once('error', onError);
            }
          });
          
          readStream.on('end', () => resolve());
          readStream.on('error', reject);
        });
      }
      
      if (writeError) {
        throw writeError;
      }
      
      const finishPromise = new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
      });
      
      writeStream.end();
      
      await finishPromise;
      
      await this.cleanupChunks(conversationId);
      
      return outputPath;
    } catch (error) {
      writeStream.destroy();
      if (fs.existsSync(outputPath)) {
        await this.deleteTempFile(outputPath);
      }
      throw error;
    }
  }

  /**
   * Checks if chunks exist for a conversation and returns the count
   */
  static async getChunkCount(conversationId: string): Promise<number> {
    try {
      const chunkDir = path.join(this.CHUNK_DIR, conversationId);
      if (!fs.existsSync(chunkDir)) {
        return 0;
      }
      
      const files = await readdir(chunkDir);
      // Count only chunk files (not metadata files)
      const chunkFiles = files.filter(f => f.startsWith('chunk_') && f.endsWith('.tmp'));
      return chunkFiles.length;
    } catch (error) {
      console.error(`[TempFileService] Error getting chunk count for ${conversationId}:`, error);
      return 0;
    }
  }

  static async deleteTempFile(filepath: string): Promise<void> {
    try {
      if (fs.existsSync(filepath)) {
        await unlink(filepath);
      }
    } catch (error) {
      console.error('[TempFileService] Failed to delete temp file:', filepath, error);
    }
  }

  static async cleanupChunks(conversationId: string): Promise<void> {
    try {
      const chunkDir = path.join(this.CHUNK_DIR, conversationId);
      
      if (fs.existsSync(chunkDir)) {
        const files = await readdir(chunkDir);
        
        for (const file of files) {
          await unlink(path.join(chunkDir, file));
        }
        
        fs.rmSync(chunkDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('[TempFileService] Failed to cleanup chunks:', error);
    }
  }

  static async cleanupOldFiles(): Promise<void> {
    await this.initialize();
    
    const now = Date.now();
    
    for (const dir of [this.TEMP_DIR, this.CHUNK_DIR]) {
      try {
        const items = await readdir(dir);
        
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stats = await stat(itemPath);
          
          if (now - stats.mtimeMs > this.MAX_AGE_MS) {
            if (stats.isDirectory()) {
              await this.cleanupChunks(item);
            } else {
              await this.deleteTempFile(itemPath);
            }
          }
        }
      } catch (error) {
        console.error(`[TempFileService] Failed to cleanup ${dir}:`, error);
      }
    }
  }

  static getFilePath(filename: string): string {
    return path.join(this.TEMP_DIR, filename);
  }
}
