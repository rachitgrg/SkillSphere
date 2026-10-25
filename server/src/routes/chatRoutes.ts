import { Router } from 'express';
import { getConversations, getMessages, createConversation } from '../controllers/chatController';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createConversationSchema } from '../utils/validators';

const router = Router();

router.use(protect);

// Messages are sent over the socket (`send_message`); REST is for history only.
router.get('/conversations', getConversations);
router.post('/conversations', validate(createConversationSchema), createConversation);
router.get('/conversations/:id/messages', getMessages);

export default router;
