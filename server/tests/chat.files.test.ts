import request from 'supertest';
import app from '../src/app';
import { features } from '../src/config/env';
import Conversation from '../src/models/Conversation';
import uploadService from '../src/services/uploadService';
import { UserRole } from '../src/types';
import { createUser } from './helpers';

describe('POST /chat/conversations/:id/files (4.6)', () => {
  afterEach(() => {
    features.cloudinary = false;
    jest.restoreAllMocks();
  });

  it('uploads for participants only and reports image vs file', async () => {
    const c = await createUser(UserRole.CLIENT);
    const f = await createUser(UserRole.FREELANCER);
    const outsider = await createUser(UserRole.FREELANCER);
    const conv = await Conversation.create({ participants: [c.user._id, f.user._id] });
    const url = `/api/v1/chat/conversations/${conv._id}/files`;

    expect((await request(app).post(url).set(c.auth).attach('file', Buffer.from('x'), 'a.pdf')).status).toBe(503);

    features.cloudinary = true;
    jest.spyOn(uploadService, 'uploadFile').mockImplementation(async (file) => ({
      url: `https://res.cloudinary.com/demo/${file.originalname}`, publicId: 'p', name: file.originalname, size: file.size, mimeType: file.mimetype, resourceType: 'image',
    }));
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const img = await request(app).post(url).set(c.auth).attach('file', png, 'shot.png').expect(201);
    expect(img.body.data).toMatchObject({ type: 'image', name: 'shot.png' });
    const doc = await request(app).post(url).set(f.auth).attach('file', Buffer.from('%PDF'), { filename: 'spec.pdf', contentType: 'application/pdf' }).expect(201);
    expect(doc.body.data.type).toBe('file');
    await request(app).post(url).set(outsider.auth).attach('file', png, 'shot.png').expect(404);
  });
});
