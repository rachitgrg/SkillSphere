import { Request, Response, NextFunction } from 'express';
import { cloudinary } from '../config/cloudinary';
import { features } from '../config/env';

/** What every upload endpoint stores and returns. */
export interface StoredFile {
  url: string;
  publicId: string;
  name: string;
  size: number;
  mimeType: string;
  resourceType: 'image' | 'raw';
}

/** 503 before multer buffers anything when Cloudinary has no credentials. */
export const requireUploads = (_req: Request, res: Response, next: NextFunction): void => {
  if (!features.cloudinary) {
    res.status(503).json({ success: false, message: 'File uploads are not configured', code: 'UPLOADS_DISABLED' });
    return;
  }
  next();
};

interface UploadFileOptions {
  /** Square face-centred crop, for avatars. */
  avatar?: boolean;
}

class UploadService {
  /** Images go to Cloudinary `image` resources; PDFs, documents and archives to `raw`. */
  uploadFile(file: Express.Multer.File, folder: string, options: UploadFileOptions = {}): Promise<StoredFile> {
    const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'raw';
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `skillsphere/${folder}`,
          resource_type: resourceType,
          // Raw files keep their extension so the download URL opens correctly.
          use_filename: resourceType === 'raw',
          unique_filename: true,
          ...(options.avatar && { transformation: [{ width: 300, height: 300, crop: 'fill', gravity: 'face' }] }),
        },
        (error, result) => {
          if (error || !result) {
            reject(Object.assign(new Error(`Upload failed: ${error?.message ?? 'no result'}`), { statusCode: 502 }));
            return;
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            name: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
            resourceType,
          });
        }
      );
      stream.end(file.buffer);
    });
  }

  uploadFiles(files: Express.Multer.File[], folder: string): Promise<StoredFile[]> {
    return Promise.all(files.map((f) => this.uploadFile(f, folder)));
  }

  /** Best-effort delete; a missing or already-deleted file is not an error. */
  async deleteFile(publicId?: string, resourceType: 'image' | 'raw' = 'image'): Promise<void> {
    if (!publicId || !features.cloudinary) return;
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (error) {
      console.warn(`Could not delete ${publicId} from Cloudinary:`, (error as Error).message);
    }
  }
}

export default new UploadService();
