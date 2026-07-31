import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';

const ffmpegPath = process.env.FFMPEG_PATH;
const ffprobePath = process.env.FFPROBE_PATH;

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}
if (ffprobePath) {
  ffmpeg.setFfprobePath(ffprobePath);
}

export class AudioCompressionService {
  static async compressAudioFile(
    inputPath: string,
    outputPath: string,
    targetBitrate: string = '32k',
    targetSampleRate: number = 16000
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(inputPath)) {
        reject(new Error(`Input file does not exist: ${inputPath}`));
        return;
      }

      const inputSize = fs.statSync(inputPath).size;
      if (inputSize === 0) {
        reject(new Error(`Input file is empty: ${inputPath}`));
        return;
      }

      ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioBitrate(targetBitrate)
        .audioFrequency(targetSampleRate)
        .audioChannels(1)
        .format('mp3')
        .on('error', (err: Error) => {
          console.error('[AudioCompression] FFmpeg error:', err);
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
          reject(new Error(`Audio compression failed: ${err.message}`));
        })
        .on('end', () => {
          const outputSize = fs.statSync(outputPath).size;
          if (outputSize === 0) {
            fs.unlinkSync(outputPath);
            reject(new Error('Compression produced zero-byte file'));
          } else {
            console.log('[AudioCompression] Compression completed');
            resolve();
          }
        })
        .save(outputPath);
    });
  }

  static async getFileSize(filepath: string): Promise<number> {
    const stats = fs.statSync(filepath);
    return stats.size;
  }

  static estimateCompressedSize(originalSize: number): number {
    return Math.ceil(originalSize * 0.15);
  }

  static async needsCompression(filepath: string, maxSizeMB: number = 24): Promise<boolean> {
    const sizeBytes = await this.getFileSize(filepath);
    const sizeMB = sizeBytes / (1024 * 1024);
    return sizeMB > maxSizeMB;
  }
}
