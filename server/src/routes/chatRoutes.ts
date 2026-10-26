import { Router } from 'express';
import { getConversations, getMessages, createConversation, uploadChatFile } from '../controllers/chatController';
import { uploadLimiter } from '../middleware/rateLimiter';
import { fileUpload } from '../middleware/upload';
import { requireUploads } from '../services/uploadService';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createConversationSchema } from '../utils/validators';

const router = Router();

router.use(protect);

// Messages are sent over the socket (`send_message`); REST is for history only.
router.get('/conversations', getConversations);
router.post('/conversations', validate(createConversationSchema), createConversation);
router.get('/conversations/:id/messages', getMessages);
router.post(
  '/conversations/:id/files',
  uploadLimiter,
  requireUploads,
  fileUpload({ field: 'file', kinds: ['image', 'document'], maxSizeMB: 10 }),
  uploadChatFile
);

export default router;
