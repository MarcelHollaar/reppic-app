import { getAuthHeaders } from "@/utils/getAuthHeaders";

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 120000;
const PARALLEL_UPLOADS = 8; // Upload 8 chunks simultaneously for 5-10x speed improvement

export interface ChunkUploadProgress {
  uploadedChunks: number;
  totalChunks: number;
  percentage: number;
}

export interface ConversationMetadata {
  title?: string;
  customer_name?: string;
  meeting_date?: string;
  meeting_time_start?: string;
  meeting_time_end?: string;
  notes?: string;
  file_duration?: string;
  deviceId?: string;
  deviceType?: string;
  conversationId?: string;
  langCode?: string;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

async function uploadChunkWithRetry(
  chunk: Blob,
  chunkIndex: number,
  totalChunks: number,
  conversationId: string,
  fileName: string
): Promise<boolean> {
  const chunkFormData = new FormData();
  chunkFormData.append('chunk', chunk);
  chunkFormData.append('chunkIndex', chunkIndex.toString());
  chunkFormData.append('totalChunks', totalChunks.toString());
  chunkFormData.append('conversationId', conversationId);
  chunkFormData.append('fileName', fileName);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const authHeaders = getAuthHeaders({}, true);
      const fetchOptions: RequestInit = {
        method: 'POST',
        body: chunkFormData,
      };
      
      if (authHeaders) {
        fetchOptions.headers = authHeaders;
      }

      const response = await fetchWithTimeout('/api/conversations/upload-chunk', fetchOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return true;

    } catch (error: any) {
      const isLastAttempt = attempt === MAX_RETRIES - 1;
      
      if (isLastAttempt) {
        console.error(`[ChunkedUpload] Chunk ${chunkIndex} failed after ${MAX_RETRIES} attempts:`, error);
        throw error;
      }

      const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[ChunkedUpload] Chunk ${chunkIndex} attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return false;
}

export async function uploadAudioInChunks(
  audioBlob: Blob,
  fileName: string,
  conversationId: string,
  metadata: ConversationMetadata,
  onProgress?: (progress: ChunkUploadProgress) => void,
  isDraft?: boolean
): Promise<{ success: boolean; conversationId?: string; error?: string; conversation?: any; failure?: boolean }> {
  const totalChunks = Math.ceil(audioBlob.size / CHUNK_SIZE);
  let uploadedChunks = 0;
  
  // Check if chunks already exist on server (from real-time upload)
  // Wait for chunks to be complete before proceeding (important for long recordings)
  const chunksStatus = await checkChunksExistOnServer(conversationId, totalChunks, true);
  
  if (chunksStatus.exists && chunksStatus.isComplete) {
    console.log(`[ChunkedUpload] All chunks already exist on server (${chunksStatus.chunkCount}/${totalChunks}), skipping upload and going directly to assembly`);
    
    // Update progress to 100% if callback provided
    if (onProgress) {
      onProgress({ uploadedChunks: totalChunks, totalChunks, percentage: 100 });
    }
    
    // Go directly to assembly
    try {
      const jsonHeaders = getAuthHeaders({ 'Content-Type': 'application/json' }, false);
      const payload: Record<string, any> = {
        conversationId,
        totalChunks,
        fileName,
        data: metadata,
        isDraft: isDraft || false,
      };
      if (metadata.langCode) {
        payload.langCode = metadata.langCode;
      }

      const assembleFetchOptions: RequestInit = {
        method: 'POST',
        body: JSON.stringify(payload),
      };

      if (jsonHeaders) {
        assembleFetchOptions.headers = jsonHeaders;
      }

      // For long recordings, increase timeout (63 minutes = ~3780 seconds, so 10 minutes should be enough for assembly)
      // But also add polling mechanism to check assembly status
      const timeoutForLongRecordings = Math.max(300000, Math.ceil(audioBlob.size / (1024 * 1024)) * 10000); // 10 seconds per MB, minimum 5 minutes
      const assembleResponse = await fetchWithTimeout(
        '/api/conversations/assemble-and-process',
        assembleFetchOptions,
        timeoutForLongRecordings
      );

      if (!assembleResponse.ok) {
        const errorData = await assembleResponse.json().catch(() => ({}));
        console.error('[ChunkedUpload] Assembly failed:', errorData);
        return {
          success: false,
          error: errorData.message || 'Failed to process uploaded audio',
        };
      }

      const result = await assembleResponse.json();
      console.log('[ChunkedUpload] Success!', result);

      return {
        success: true,
        conversationId: result.conversation?.id,
        conversation: result.conversation,
        failure: result.failure,
      };
    } catch (error) {
      console.error('[ChunkedUpload] Assembly error:', error);
      return {
        success: false,
        error: 'Failed to process uploaded audio',
      };
    }
  }
  
  console.log(`[ChunkedUpload] Starting parallel upload: ${audioBlob.size} bytes, ${totalChunks} chunks (${PARALLEL_UPLOADS} concurrent)`);

  const chunks: { index: number; blob: Blob }[] = [];
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, audioBlob.size);
    const chunk = audioBlob.slice(start, end);
    chunks.push({ index: chunkIndex, blob: chunk });
  }

  for (let i = 0; i < totalChunks; i += PARALLEL_UPLOADS) {
    const batch = chunks.slice(i, Math.min(i + PARALLEL_UPLOADS, totalChunks));
    
    try {
      const uploadPromises = batch.map(async ({ index, blob }) => {
        await uploadChunkWithRetry(blob, index, totalChunks, conversationId, fileName);
        return index;
      });

      const completedIndices = await Promise.all(uploadPromises);
      
      uploadedChunks += completedIndices.length;
      const percentage = Math.round((uploadedChunks / totalChunks) * 100);
      
      if (onProgress) {
        onProgress({ uploadedChunks, totalChunks, percentage });
      }

      console.log(`[ChunkedUpload] Batch complete: ${uploadedChunks}/${totalChunks} chunks uploaded (${percentage}%)`);
      
    } catch (error: any) {
      console.error(`[ChunkedUpload] Batch upload error:`, error);
      return {
        success: false,
        error: error.message || `Failed to upload chunks in batch starting at ${i + 1}`,
      };
    }
  }

  console.log('[ChunkedUpload] All chunks uploaded, assembling and processing...');

  try {
    const jsonHeaders = getAuthHeaders({ 'Content-Type': 'application/json' }, false);
    const payload: Record<string, any> = {
      conversationId,
      totalChunks,
      fileName,
      data: metadata,
      isDraft: isDraft || false,
    };
    if (metadata.langCode) {
      payload.langCode = metadata.langCode;
    }

    const assembleFetchOptions: RequestInit = {
      method: 'POST',
      body: JSON.stringify(payload),
    };

    if (jsonHeaders) {
      assembleFetchOptions.headers = jsonHeaders;
    }

    // For long recordings, increase timeout (63 minutes = ~3780 seconds, so 10 minutes should be enough for assembly)
    const timeoutForLongRecordings = Math.max(300000, Math.ceil(audioBlob.size / (1024 * 1024)) * 10000); // 10 seconds per MB, minimum 5 minutes
    const assembleResponse = await fetchWithTimeout(
      '/api/conversations/assemble-and-process',
      assembleFetchOptions,
      timeoutForLongRecordings
    );

    if (!assembleResponse.ok) {
      const errorData = await assembleResponse.json().catch(() => ({}));
      console.error('[ChunkedUpload] Assembly failed:', errorData);
      return {
        success: false,
        error: errorData.message || 'Failed to process uploaded audio',
      };
    }

    const result = await assembleResponse.json();
    console.log('[ChunkedUpload] Success!', result);

    return {
      success: true,
      conversationId: result.conversation?.id,
      conversation: result.conversation,
      failure: result.failure,
    };
  } catch (error) {
    console.error('[ChunkedUpload] Assembly error:', error);
    return {
      success: false,
      error: 'Failed to process uploaded audio',
    };
  }
}

export function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Uploads a single chunk in real-time during recording
 * This is used for background chunk sync to prevent data loss on browser crash
 * @param chunk The audio chunk blob
 * @param chunkIndex The index of this chunk (0-based)
 * @param conversationId The conversation ID
 * @param fileName The file name
 * @param totalChunksEstimate Estimated total chunks (may be updated as recording continues)
 * @returns Promise that resolves when chunk is uploaded (or fails silently)
 */
export async function uploadChunkRealtime(
  chunk: Blob,
  chunkIndex: number,
  conversationId: string,
  fileName: string,
  totalChunksEstimate: number
): Promise<boolean> {
  try {
    const chunkFormData = new FormData();
    chunkFormData.append('chunk', chunk);
    chunkFormData.append('chunkIndex', chunkIndex.toString());
    chunkFormData.append('totalChunks', totalChunksEstimate.toString());
    chunkFormData.append('conversationId', conversationId);
    chunkFormData.append('fileName', fileName);

    const authHeaders = getAuthHeaders({}, true);
    const fetchOptions: RequestInit = {
      method: 'POST',
      body: chunkFormData,
      // Use keepalive for better reliability during page unload
      keepalive: true,
    };
    
    if (authHeaders) {
      fetchOptions.headers = authHeaders;
    }

    // Shorter timeout for real-time uploads (10 seconds)
    const response = await fetchWithTimeout('/api/conversations/upload-chunk', fetchOptions, 10000);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn(`[RealtimeUpload] Chunk ${chunkIndex} upload failed:`, errorData.message || `HTTP ${response.status}`);
      return false;
    }

    return true;
  } catch (error: any) {
    // Silently fail for real-time uploads - IndexedDB is the primary storage
    console.warn(`[RealtimeUpload] Chunk ${chunkIndex} upload error (non-critical):`, error.message);
    return false;
  }
}

/**
 * Checks if chunks already exist on server for a conversation
 * Used to determine if we can skip upload and go directly to assembly
 * @param conversationId The conversation ID
 * @param expectedChunkCount The expected number of chunks
 * @param waitForComplete If true, will poll until all chunks are complete (max 30 seconds)
 * @returns Object with exists, isComplete, and chunkCount
 */
export async function checkChunksExistOnServer(
  conversationId: string,
  expectedChunkCount: number,
  waitForComplete: boolean = false
): Promise<{ exists: boolean; isComplete: boolean; chunkCount: number }> {
  try {
    const authHeaders = getAuthHeaders({ 'Content-Type': 'application/json' }, false);
    const maxWaitTime = 30000; // 30 seconds max wait
    const pollInterval = 1000; // Check every second
    const startTime = Date.now();

    const checkChunks = async (): Promise<{ exists: boolean; isComplete: boolean; chunkCount: number }> => {
      const response = await fetch(`/api/conversations/check-chunks?conversationId=${conversationId}&expectedCount=${expectedChunkCount}`, {
        method: 'GET',
        headers: authHeaders || {},
      });

      if (!response.ok) {
        return { exists: false, isComplete: false, chunkCount: 0 };
      }

      const data = await response.json();
      return {
        exists: data.exists === true,
        isComplete: data.isComplete === true,
        chunkCount: data.chunkCount || 0,
      };
    };

    // First check
    let result = await checkChunks();

    // If waitForComplete is true and chunks exist but aren't complete, poll until complete
    if (waitForComplete && result.exists && !result.isComplete && expectedChunkCount > 0) {
      console.log(`[ChunkedUpload] Chunks exist but not complete (${result.chunkCount}/${expectedChunkCount}), waiting for completion...`);
      
      while (!result.isComplete && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        result = await checkChunks();
        
        if (result.chunkCount > 0) {
          const percentage = Math.round((result.chunkCount / expectedChunkCount) * 100);
          console.log(`[ChunkedUpload] Waiting for chunks: ${result.chunkCount}/${expectedChunkCount} (${percentage}%)`);
        }
      }

      if (result.isComplete) {
        console.log(`[ChunkedUpload] All chunks are now complete (${result.chunkCount}/${expectedChunkCount})`);
      } else {
        console.warn(`[ChunkedUpload] Timeout waiting for chunks to complete. Current: ${result.chunkCount}/${expectedChunkCount}`);
      }
    }

    return result;
  } catch (error) {
    console.warn('[ChunkedUpload] Failed to check chunks on server:', error);
    return { exists: false, isComplete: false, chunkCount: 0 };
  }
}
