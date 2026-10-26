import request from 'supertest';
import app from '../src/app';
import Conversation from '../src/models/Conversation';
import Notification from '../src/models/Notification';
import chatService from '../src/services/chatService';
import emailService from '../src/services/emailService';
import { NotificationType, UserRole } from '../src/types';
import { createUser } from './helpers';

afterEach(() => jest.restoreAllMocks());

describe('notification preferences (4.11)', () => {
  it('returns defaults (message emails off) and saves partial updates', async () => {
    const u = await createUser(UserRole.CLIENT);
    const res = await request(app).get('/api/v1/users/me/notification-preferences').set(u.auth).expect(200);
    expect(res.body.data.email).toMatchObject({ proposals: true, messages: false });
    expect(res.body.data.inApp.messages).toBe(true);

    const saved = await request(app).put('/api/v1/users/me/notification-preferences').set(u.auth).send({ email: { payments: false }, inApp: { reviews: false } }).expect(200);
    expect(saved.body.data.email).toMatchObject({ payments: false, proposals: true });
    expect(saved.body.data.inApp.reviews).toBe(false);
    await request(app).put('/api/v1/users/me/notification-preferences').set(u.auth).send({ email: { hacking: true } }).expect(400);
  });

  it('notifies offline chat recipients, emailing only when they opted in', async () => {
    const email = jest.spyOn(emailService, 'sendNotificationEmail').mockResolvedValue();
    const a = await createUser(UserRole.CLIENT);
    const b = await createUser(UserRole.FREELANCER);
    const conv = await Conversation.create({ participants: [a.user._id, b.user._id] });

    await chatService.sendMessage(a.user.id, { conversationId: conv.id, content: 'Hi there' });
    expect(await Notification.countDocuments({ recipient: b.user._id, type: NotificationType.MESSAGE_RECEIVED })).toBe(1);
    expect(email).not.toHaveBeenCalled();

    await request(app).put('/api/v1/users/me/notification-preferences').set(b.auth).send({ email: { messages: true } }).expect(200);
    await chatService.sendMessage(a.user.id, { conversationId: conv.id, content: 'Ping' });
    expect(email).toHaveBeenCalledTimes(1);
  });
});
