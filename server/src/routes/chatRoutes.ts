import { Router } from 'express';
import { getConversations, getMessages, createConversation, sendMessage } from '../controllers/chatController';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createConversationSchema } from '../utils/validators';

const router = Router();

router.use(protect);

router.get('/', getConversations);
router.post('/', validate(createConversationSchema), createConversation);
router.get('/:conversationId/messages', getMessages);
router.post('/messages', sendMessage);

export default router;
