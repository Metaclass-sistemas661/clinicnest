/**
 * Google Cloud Storage module.
 * 
 * 100% GCP — uses @google-cloud/storage.
 * Provides download/upload with same error pattern as before.
 */
import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'sistema-de-gestao-16e15';

// Bucket name mapping (logical bucket → GCS bucket)
const BUCKET_MAP: Record<string, string> = {
  'avatars': 'clinicnest-avatars',
  'medical-records': 'clinicnest-medical-records',
  'consent-documents': 'clinicnest-consent-documents',
  'consent-photos': 'clinicnest-consent-photos',
  'consent-signatures': 'clinicnest-consent-signatures',
  'patient-exams': 'clinicnest-patient-exams',
  'document-signatures': 'clinicnest-document-signatures',
};

interface StorageResult<T = any> {
  data: T | null;
  error: { message: string; statusCode?: string } | null;
}

class StorageBucketClient {
  private bucketName: string;

  constructor(bucketName: string) {
    // Map from logical bucket name to GCS bucket name
    this.bucketName = BUCKET_MAP[bucketName] || bucketName;
  }

  /**
   * Download file from bucket.
   * Returns Buffer data.
   */
  async download(path: string): Promise<StorageResult<Buffer>> {
    try {
      const bucket = storage.bucket(this.bucketName);
      const file = bucket.file(path);
      const [contents] = await file.download();
      return { data: contents, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message, statusCode: err.code } };
    }
  }

  /**
   * Upload file to bucket.
   * Accepts Buffer or string.
   */
  async upload(
    path: string,
    data: Buffer | string | Uint8Array,
    options?: { contentType?: string; upsert?: boolean; cacheControl?: string }
  ): Promise<StorageResult<{ path: string }>> {
    try {
      const bucket = storage.bucket(this.bucketName);
      const file = bucket.file(path);

      await file.save(Buffer.isBuffer(data) ? data : Buffer.from(data as any), {
        contentType: options?.contentType || 'application/octet-stream',
        metadata: {
          cacheControl: options?.cacheControl || 'public, max-age=3600',
        },
        resumable: false,
      });

      return { data: { path }, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message, statusCode: err.code } };
    }
  }

  /**
   * Get a signed URL for temporary access.
   */
  async createSignedUrl(path: string, expiresIn: number = 3600): Promise<StorageResult<{ signedUrl: string }>> {
    try {
      const bucket = storage.bucket(this.bucketName);
      const file = bucket.file(path);
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresIn * 1000,
      });
      return { data: { signedUrl: url }, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message, statusCode: err.code } };
    }
  }

  /**
   * Delete file from bucket.
   */
  async remove(paths: string[]): Promise<StorageResult<void>> {
    try {
      const bucket = storage.bucket(this.bucketName);
      await Promise.all(paths.map(p => bucket.file(p).delete().catch(() => {})));
      return { data: null, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message, statusCode: err.code } };
    }
  }

  /**
   * List files in a path prefix.
   */
  async list(prefix?: string, options?: { limit?: number }): Promise<StorageResult<Array<{ name: string }>>> {
    try {
      const bucket = storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles({
        prefix: prefix || undefined,
        maxResults: options?.limit,
      });
      return { data: files.map(f => ({ name: f.name })), error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message, statusCode: err.code } };
    }
  }

  /**
   * Get public URL for a file.
   */
  getPublicUrl(path: string): { data: { publicUrl: string } } {
    return {
      data: {
        publicUrl: `https://storage.googleapis.com/${this.bucketName}/${path}`,
      },
    };
  }
}

// ─── Storage Client (mimics storage API) ────────────────────────
export interface GcsStorageClient {
  from: (bucket: string) => StorageBucketClient;
}

export function createStorageClient(): GcsStorageClient {
  return {
    from: (bucket: string) => new StorageBucketClient(bucket),
  };
}
