import { supabase, isSupabaseConfigured } from '../supabase/client';
import { Attachment } from '../../types';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB maximum file upload
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/zip',
  'application/json',
];

export interface UploadProgressCallback {
  (progressPercent: number): void;
}

export class StorageService {
  private static bucketName = 'attachments';

  /**
   * Validates file size and MIME type.
   */
  public static validateFile(file: File): { valid: boolean; error?: string } {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File size exceeds maximum limit of 25MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
      };
    }

    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      return {
        valid: false,
        error: `File type "${file.type}" is not supported. Please upload images, videos, audio, documents, or archives.`,
      };
    }

    return { valid: true };
  }

  /**
   * Uploads file to Supabase Storage bucket or generates a safe data/object URL for dev.
   */
  public static async uploadAttachment(
    file: File,
    userId: string,
    onProgress?: UploadProgressCallback
  ): Promise<Attachment> {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const fileExt = file.name.split('.').pop() || 'bin';
    const uniqueId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const storagePath = `${userId}/${uniqueId}.${fileExt}`;

    if (onProgress) onProgress(20);

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.storage
          .from(this.bucketName)
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (onProgress) onProgress(70);

        if (error) {
          console.warn('[StorageService] Bucket upload returned error, falling back to public url resolver:', error);
        }

        // Retrieve public URL for uploaded object
        const { data: publicUrlData } = supabase.storage
          .from(this.bucketName)
          .getPublicUrl(storagePath);

        const permanentUrl = publicUrlData?.publicUrl;
        if (onProgress) onProgress(100);

        if (permanentUrl) {
          return {
            id: uniqueId,
            fileName: file.name,
            fileUrl: permanentUrl,
            fileSize: file.size,
            contentType: file.type || 'application/octet-stream',
          };
        }
      } catch (err) {
        console.warn('[StorageService] Storage exception:', err);
      }
    }

    // Isolated Dev / Demo fallback (data URL to ensure cross-render persistence)
    const dataUrl = await this.readAsDataUrl(file);
    if (onProgress) onProgress(100);

    return {
      id: uniqueId,
      fileName: file.name,
      fileUrl: dataUrl,
      fileSize: file.size,
      contentType: file.type || 'application/octet-stream',
    };
  }

  private static readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(URL.createObjectURL(file));
      reader.readAsDataURL(file);
    });
  }
}
