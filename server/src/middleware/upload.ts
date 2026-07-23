import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage();

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedDocTypes = /pdf|doc|docx|txt|zip|rar/;

  const extname = path.extname(file.originalname).toLowerCase().replace('.', '');
  const mimetype = file.mimetype;

  const isImageExt = allowedImageTypes.test(extname);
  const isImageMime = /image\/(jpeg|jpg|png|gif|webp)/.test(mimetype);

  const isDocExt = allowedDocTypes.test(extname);
  const isDocMime =
    /application\/(pdf|msword|vnd\.openxmlformats|zip|x-rar|octet-stream)/.test(mimetype) ||
    mimetype === 'text/plain';

  if ((isImageExt && isImageMime) || (isDocExt && isDocMime)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.originalname}`));
  }
};

export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
}).single('file');

export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
}).array('files', 5);

export const uploadAvatar = multer({
  storage,
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = path.extname(file.originalname).toLowerCase().replace('.', '');
    const mimetype = /image\/(jpeg|jpg|png|webp)/.test(file.mimetype);

    if (allowedTypes.test(extname) && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
}).single('avatar');

export const uploadToCloudinary = async (
  file: Express.Multer.File,
  folder: string = 'skillsphere'
): Promise<{ url: string; publicId: string }> => {
  const { cloudinary } = await import('../config/cloudinary');

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        transformation: folder === 'avatars'
          ? [{ width: 300, height: 300, crop: 'fill', gravity: 'face' }]
          : undefined,
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        } else {
          reject(new Error('Cloudinary upload returned no result'));
        }
      }
    );

    uploadStream.end(file.buffer);
  });
};
