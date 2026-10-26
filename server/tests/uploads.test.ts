import request from 'supertest';
import app from '../src/app';
import { features } from '../src/config/env';
import AdminLog from '../src/models/AdminLog';
import FreelancerProfile from '../src/models/FreelancerProfile';
import Notification from '../src/models/Notification';
import uploadService, { StoredFile } from '../src/services/uploadService';
import { NotificationType, ProficiencyLevel, UserRole } from '../src/types';
import { createUser } from './helpers';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

/** A one-page PDF whose only content is `text` (pdf.js tolerates the approximate xref). */
const pdfWith = (text: string): Buffer => {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
};

let counter = 0;
const fakeStore = (file: Express.Multer.File): StoredFile => {
  counter += 1;
  return {
    url: `https://res.cloudinary.test/${counter}/${file.originalname}`,
    publicId: `skillsphere/test/${counter}`,
    name: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
    resourceType: file.mimetype.startsWith('image/') ? 'image' : 'raw',
  };
};

describe('uploads without Cloudinary', () => {
  it('answer 503 before reading the body', async () => {
    const f = await createUser(UserRole.FREELANCER);
    const res = await request(app).post('/api/v1/users/freelancers/me/resume').set(f.auth).attach('resume', pdfWith('x'), 'cv.pdf');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('UPLOADS_DISABLED');
  });
});

describe('uploads with Cloudinary (mocked)', () => {
  let upload: jest.SpyInstance;
  let remove: jest.SpyInstance;

  beforeEach(() => {
    features.cloudinary = true;
    upload = jest.spyOn(uploadService, 'uploadFile').mockImplementation(async (file) => fakeStore(file));
    remove = jest.spyOn(uploadService, 'deleteFile').mockResolvedValue();
  });
  afterEach(() => {
    features.cloudinary = false;
    jest.restoreAllMocks();
  });

  it('sets the avatar and rejects non-images', async () => {
    const c = await createUser(UserRole.CLIENT);
    const res = await request(app).post('/api/v1/users/me/avatar').set(c.auth).attach('avatar', PNG, 'me.png').expect(200);
    expect(res.body.data.avatar).toMatch(/me\.png$/);
    expect(upload).toHaveBeenCalledWith(expect.anything(), 'avatars', { avatar: true });

    const bad = await request(app).post('/api/v1/users/me/avatar').set(c.auth).attach('avatar', Buffer.from('hi'), 'x.txt');
    expect(bad.status).toBe(400);
  });

  it('stores a resume, replaces the old file and enforces type and size', async () => {
    const f = await createUser(UserRole.FREELANCER);
    await request(app).post('/api/v1/users/freelancers/me/resume').set(f.auth).attach('resume', pdfWith('one'), 'cv.pdf').expect(200);
    const res = await request(app).post('/api/v1/users/freelancers/me/resume').set(f.auth).attach('resume', pdfWith('two'), 'cv2.pdf').expect(200);
    expect(res.body.data.resume).toMatchObject({ name: 'cv2.pdf', mimeType: 'application/pdf' });
    expect(remove).toHaveBeenCalledWith(expect.stringMatching(/^skillsphere\/test\//), 'raw');

    expect((await request(app).post('/api/v1/users/freelancers/me/resume').set(f.auth).attach('resume', PNG, 'cv.png')).status).toBe(400);
    const big = Buffer.alloc(5 * 1024 * 1024 + 1);
    const tooBig = await request(app).post('/api/v1/users/freelancers/me/resume').set(f.auth).attach('resume', big, 'cv.pdf');
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.message).toMatch(/5 MB/);

    const del = await request(app).delete('/api/v1/users/freelancers/me/resume').set(f.auth).expect(200);
    expect(del.body.data.resume).toBeUndefined();
  });

  it('adds portfolio items with images and deletes their files with the item', async () => {
    const f = await createUser(UserRole.FREELANCER);
    const res = await request(app)
      .post('/api/v1/users/freelancers/me/portfolio')
      .set(f.auth)
      .field('title', 'Shop')
      .field('description', 'An online shop')
      .field('technologies', 'React, Node.js')
      .attach('images', PNG, 'a.png')
      .attach('images', PNG, 'b.png')
      .expect(201);
    const item = res.body.data.portfolio[0];
    expect(item.images).toHaveLength(2);
    expect(item.technologies).toEqual(['React', 'Node.js']);
    expect(item.imagePublicIds).toBeUndefined();

    const missingTitle = await request(app).post('/api/v1/users/freelancers/me/portfolio').set(f.auth).field('description', 'x');
    expect(missingTitle.status).toBe(400);

    await request(app).delete(`/api/v1/users/freelancers/me/portfolio/${item._id}`).set(f.auth).expect(200);
    expect(remove).toHaveBeenCalledTimes(2);
    await request(app).delete(`/api/v1/users/freelancers/me/portfolio/${item._id}`).set(f.auth).expect(404);
  });

  it('runs the verification flow and keeps documents private', async () => {
    const f = await createUser(UserRole.FREELANCER);
    const admin = await createUser(UserRole.ADMIN);

    const req1 = await request(app)
      .post('/api/v1/users/freelancers/me/verification-request')
      .set(f.auth)
      .field('message', 'My Aadhaar card')
      .attach('documents', PNG, 'id.png')
      .expect(200);
    expect(req1.body.data.verification.status).toBe('pending');
    expect(req1.body.data.verification.documents).toBeUndefined();
    const again = await request(app).post('/api/v1/users/freelancers/me/verification-request').set(f.auth).attach('documents', PNG, 'id.png');
    expect(again.status).toBe(409);

    const publicProfile = await request(app).get(`/api/v1/users/freelancers/${f.user._id}`).expect(200);
    expect(publicProfile.body.data.verification.documents).toBeUndefined();

    const queue = await request(app).get('/api/v1/admin/verifications').set(admin.auth).expect(200);
    expect(queue.body.data).toHaveLength(1);
    expect(queue.body.data[0].verification.documents[0].name).toBe('id.png');

    await request(app).put(`/api/v1/admin/freelancers/${f.user._id}/verify`).set(admin.auth).expect(200);
    expect((await FreelancerProfile.findOne({ user: f.user._id }))!.verification.status).toBe('verified');
    expect(await AdminLog.countDocuments({ targetId: f.user._id })).toBe(1);
    expect(await Notification.countDocuments({ recipient: f.user._id, type: NotificationType.VERIFICATION_UPDATE })).toBe(1);
    await request(app).put(`/api/v1/admin/freelancers/${f.user._id}/verify`).set(admin.auth).expect(409);
  });

  it('lets admins reject with a reason, after which the freelancer may ask again', async () => {
    const f = await createUser(UserRole.FREELANCER);
    const admin = await createUser(UserRole.ADMIN);
    await request(app).post('/api/v1/users/freelancers/me/verification-request').set(f.auth).attach('documents', PNG, 'id.png').expect(200);
    await request(app).put(`/api/v1/admin/freelancers/${f.user._id}/reject-verification`).set(admin.auth).send({}).expect(400);
    await request(app).put(`/api/v1/admin/freelancers/${f.user._id}/reject-verification`).set(admin.auth).send({ reason: 'Blurry photo' }).expect(200);
    const profile = await request(app).get('/api/v1/users/me').set(f.auth).expect(200);
    expect(profile.body.data.profile.verification).toMatchObject({ status: 'rejected', note: 'Blurry photo' });
    await request(app).post('/api/v1/users/freelancers/me/verification-request').set(f.auth).attach('documents', PNG, 'id2.png').expect(200);
  });
});

describe('verified badge in search', () => {
  it('boosts verified freelancers on equal ratings and hides private fields', async () => {
    const plain = await createUser(UserRole.FREELANCER);
    const verified = await createUser(UserRole.FREELANCER);
    const skills = [{ name: 'React', proficiency: ProficiencyLevel.EXPERT, yearsOfExperience: 4 }];
    await FreelancerProfile.updateOne({ user: plain.user._id }, { $set: { skills, averageRating: 4.6, totalReviews: 10 } });
    await FreelancerProfile.updateOne(
      { user: verified.user._id },
      { $set: { skills, averageRating: 4.5, totalReviews: 10, 'verification.status': 'verified', 'verification.documents': [{ url: 'secret' }], embedding: [1, 2] } }
    );

    const res = await request(app).get('/api/v1/search/freelancers?skills=React').expect(200);
    const rows = res.body.data;
    expect(rows[0].user._id).toBe(verified.user._id.toString());
    expect(rows[0].verification.documents).toBeUndefined();
    expect(rows[0].embedding).toBeUndefined();

    const onlyVerified = await request(app).get('/api/v1/search/freelancers?verified=true').expect(200);
    expect(onlyVerified.body.data).toHaveLength(1);
  });
});

describe('POST /ai/resume-analysis', () => {
  const resume = 'Senior React and Node.js developer with six years building SaaS dashboards and REST APIs for startups.';

  it('analyses an uploaded PDF or TXT without Cloudinary', async () => {
    const f = await createUser(UserRole.FREELANCER);
    const fromPdf = await request(app).post('/api/v1/ai/resume-analysis').set(f.auth).attach('resume', pdfWith(resume), 'cv.pdf').expect(200);
    expect(fromPdf.body.data.source).toBe('fallback');
    expect(fromPdf.body.data.targetRoles).toContain('Full Stack Architect');

    const fromTxt = await request(app)
      .post('/api/v1/ai/resume-analysis')
      .set(f.auth)
      .attach('resume', Buffer.from(resume), { filename: 'cv.txt', contentType: 'text/plain' })
      .expect(200);
    expect(fromTxt.body.data.summary).toBeTruthy();
  });

  it('rejects files without enough text and requires a resume', async () => {
    const f = await createUser(UserRole.FREELANCER);
    await request(app).post('/api/v1/ai/resume-analysis').set(f.auth).attach('resume', pdfWith('Hi'), 'cv.pdf').expect(400);
    const none = await request(app).post('/api/v1/ai/resume-analysis').set(f.auth).expect(400);
    expect(none.body.message).toMatch(/Upload a resume/);
  });
});
