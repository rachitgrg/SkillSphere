import { Router } from 'express';
import { getConversations, getMessages, createConversation, sendMessage } from '../controllers/chatController';
import { protect } from '../middleware/auth';

const router = Router();

router.use(protect);

router.get('/', getConversations);
router.post('/', createConversation);
router.get('/:conversationId/messages', getMessages);
router.post('/messages', sendMessage);

export default router;
