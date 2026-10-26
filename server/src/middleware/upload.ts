import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction, RequestHandler } from 'express';

/** What a route accepts. Extension and MIME type must both match. */
export type FileKind = 'image' | 'document' | 'resume';

const KINDS: Record<FileKind, { ext: RegExp; mime: RegExp; label: string }> = {
  image: { ext: /^(jpe?g|png|gif|webp)$/, mime: /^image\/(jpeg|png|gif|webp)$/, label: 'JPEG, PNG, GIF or WebP images' },
  document: {
    ext: /^(pdf|docx?|txt|zip)$/,
    mime: /^(application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|zip|x-zip-compressed|octet-stream)|text\/plain)$/,
    label: 'PDF, DOC, DOCX, TXT or ZIP files',
  },
  resume: {
    ext: /^(pdf|docx?)$/,
    mime: /^application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|octet-stream)$/,
    label: 'PDF, DOC or DOCX files',
  },
};

interface UploadOptions {
  /** Multipart field name. */
  field: string;
  kinds: FileKind[];
  maxFiles?: number;
  maxSizeMB?: number;
  /** Respond 400 when no file was sent. */
  required?: boolean;
}

/**
 * Parses multipart uploads into memory (`req.file` when maxFiles is 1, otherwise `req.files`).
 * Type, size and count errors become 400 responses.
 */
export const fileUpload = ({ field, kinds, maxFiles = 1, maxSizeMB = 10, required = true }: UploadOptions): RequestHandler => {
  const accepted = kinds.map((k) => KINDS[k]);
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeMB * 1024 * 1024, files: maxFiles },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(1);
      const ok = accepted.some((k) => k.ext.test(ext) && k.mime.test(file.mimetype));
      if (ok) cb(null, true);
      else cb(new Error(`${file.originalname}: only ${accepted.map((k) => k.label).join(' or ')} are allowed`));
    },
  });
  const handler = maxFiles === 1 ? parser.single(field) : parser.array(field, maxFiles);

  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, (err?: unknown) => {
      if (err) {
        const message =
          err instanceof multer.MulterError
            ? err.code === 'LIMIT_FILE_SIZE'
              ? `Files must be ${maxSizeMB} MB or smaller`
              : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
                ? `Upload at most ${maxFiles} file${maxFiles === 1 ? '' : 's'} in the "${field}" field`
                : err.message
            : (err as Error).message;
        res.status(400).json({ success: false, message });
        return;
      }
      const count = req.file ? 1 : Array.isArray(req.files) ? req.files.length : 0;
      if (required && count === 0) {
        res.status(400).json({ success: false, message: `No file uploaded (field "${field}")` });
        return;
      }
      next();
    });
  };
};

/** Files from a fileUpload() with maxFiles > 1 (or the single file as a list). */
export const uploadedFiles = (req: Request): Express.Multer.File[] =>
  req.file ? [req.file] : Array.isArray(req.files) ? req.files : [];
