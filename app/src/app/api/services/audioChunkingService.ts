import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { TempFileService } from './tempFileService';

const ffmpegPath = process.env.FFMPEG_PATH;
const ffprobePath = process.env.FFPROBE_PATH;

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}
if (ffprobePath) {
  ffmpeg.setFfprobePath(ffprobePath);
}

export interface AudioChunkInfo {
  filepath: string;
  index: number;
  size: number;
}

export class AudioChunkingService {
  private static readonly MAX_CHUNK_SIZE_MB = 24;

  static async splitAudioFile(
    inputPath: string,
    outputDir: string
  ): Promise<AudioChunkInfo[]> {
    const fileSize = fs.statSync(inputPath).size;
    const fileSizeMB = fileSize / (1024 * 1024);
    
    if (fileSizeMB <= this.MAX_CHUNK_SIZE_MB) {
      return [{
        filepath: inputPath,
        index: 0,
        size: fileSize
      }];
    }

    const numChunks = Math.ceil(fileSizeMB / this.MAX_CHUNK_SIZE_MB);
    const chunkDurationSeconds = await this.getAudioDuration(inputPath) / numChunks;
    
    console.log(`[AudioChunking] Splitting ${fileSizeMB.toFixed(2)}MB into ${numChunks} chunks`);

    const chunks: AudioChunkInfo[] = [];
    
    for (let i = 0; i < numChunks; i++) {
      const startTime = i * chunkDurationSeconds;
      const chunkPath = path.join(outputDir, `chunk_${i}.mp3`);
      
      await this.extractChunk(inputPath, chunkPath, startTime, chunkDurationSeconds);
      
      const chunkSize = fs.statSync(chunkPath).size;
      chunks.push({
        filepath: chunkPath,
        index: i,
        size: chunkSize
      });
      
      console.log(`[AudioChunking] Created chunk ${i}: ${(chunkSize / (1024 * 1024)).toFixed(2)}MB`);
    }
    
    return chunks;
  }

  private static async extractChunk(
    inputPath: string,
    outputPath: string,
    startTime: number,
    duration: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .audioCodec('copy')
        .format('mp3')
        .on('error', (err: Error) => {
          reject(new Error(`Failed to extract chunk: ${err.message}`));
        })
        .on('end', () => {
          resolve();
        })
        .save(outputPath);
    });
  }

  private static async getAudioDuration(filepath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filepath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });
  }

  static async mergeTranscripts(transcripts: string[]): Promise<string> {
    return transcripts
      .filter(t => t && t.trim().length > 0)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static async cleanupChunks(chunks: AudioChunkInfo[]): Promise<void> {
    for (const chunk of chunks) {
      await TempFileService.deleteTempFile(chunk.filepath);
    }
  }
}
