import http from 'http';
import { AddressInfo } from 'net';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { initializeSocket, getIO, resetSocketState } from '../src/config/socket';
import { registerChatHandlers } from '../src/sockets/chatSocket';
import Conversation from '../src/models/Conversation';
import Message from '../src/models/Message';
import User from '../src/models/User';
import { UserRole } from '../src/types';
import { createUser } from './helpers';

let server: http.Server;
let url: string;
const sockets: ClientSocket[] = [];

beforeAll(async () => {
  server = http.createServer();
  initializeSocket(server, [registerChatHandlers]);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => {
  sockets.splice(0).forEach((s) => s.disconnect());
});

afterAll(async () => {
  getIO().close();
  resetSocketState();
  await new Promise((resolve) => server.close(resolve));
});

const connect = (token?: string): Promise<ClientSocket> =>
  new Promise((resolve, reject) => {
    const socket = ioClient(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });

type AckResponse = { ok: boolean; error?: string; message?: { content: string; sender: { _id: string } } };

const emitAck = (socket: ClientSocket, event: string, payload: unknown): Promise<AckResponse> =>
  new Promise((resolve) => socket.emit(event, payload, resolve));

/** Resolves with the events of `name` received within `ms`. */
const collect = <T>(socket: ClientSocket, name: string, ms = 300): Promise<T[]> =>
  new Promise((resolve) => {
    const seen: T[] = [];
    socket.on(name, (data: T) => seen.push(data));
    setTimeout(() => resolve(seen), ms);
  });

const setup = async () => {
  const client = await createUser(UserRole.CLIENT);
  const freelancer = await createUser(UserRole.FREELANCER);
  const outsider = await createUser(UserRole.FREELANCER);
  const conversation = await Conversation.create({ participants: [client.user._id, freelancer.user._id] });
  return { client, freelancer, outsider, conversationId: conversation.id as string };
};

describe('Socket.IO security (C7)', () => {
  it('rejects connections without a valid token', async () => {
    await expect(connect()).rejects.toThrow(/Authentication required/);
    await expect(connect('garbage')).rejects.toThrow(/Invalid token/);
  });

  it('rejects banned users', async () => {
    const { client } = await setup();
    await User.updateOne({ _id: client.user._id }, { isBanned: true });
    await expect(connect(client.token)).rejects.toThrow(/not active/);
  });

  it('does not let a non-participant join a conversation', async () => {
    const { outsider, conversationId } = await setup();
    const socket = await connect(outsider.token);
    const res = await emitAck(socket, 'join_conversation', { conversationId });
    expect(res.ok).toBe(false);
  });

  it('a non-participant cannot send into a conversation and nothing is persisted', async () => {
    const { client, outsider, conversationId } = await setup();
    const victim = await connect(client.token);
    await emitAck(victim, 'join_conversation', { conversationId });
    const received = collect(victim, 'message:new');

    const attacker = await connect(outsider.token);
    const res = await emitAck(attacker, 'send_message', { conversationId, content: 'Your account is locked, send OTP' });

    expect(res.ok).toBe(false);
    expect(await received).toHaveLength(0);
    expect(await Message.countDocuments()).toBe(0);
  });

  it('a non-participant does not receive messages from the conversation', async () => {
    const { client, freelancer, outsider, conversationId } = await setup();
    const attacker = await connect(outsider.token);
    await emitAck(attacker, 'join_conversation', { conversationId });
    const leaked = collect(attacker, 'message:new');

    const sender = await connect(client.token);
    await emitAck(sender, 'join_conversation', { conversationId });
    const res = await emitAck(sender, 'send_message', { conversationId, content: 'private' });
    expect(res.ok).toBe(true);
    expect(await leaked).toHaveLength(0);
    expect(freelancer).toBeDefined();
  });

  it('cannot join another user’s personal room by event', async () => {
    const { client, outsider } = await setup();
    const attacker = await connect(outsider.token);
    const res = await emitAck(attacker, 'join_conversation', `user:${client.user.id}`);
    expect(res.ok).toBe(false);
  });

  it('participants receive the persisted message with the server-side sender', async () => {
    const { client, freelancer, conversationId } = await setup();
    const receiver = await connect(freelancer.token);
    await emitAck(receiver, 'join_conversation', { conversationId });
    const inbox = collect<{ content: string; sender: { _id: string } }>(receiver, 'message:new');
    const personal = collect(receiver, 'conversation:updated');

    const sender = await connect(client.token);
    const res = await emitAck(sender, 'send_message', {
      conversationId,
      content: 'Hello!',
      sender: freelancer.user.id, // spoof attempt: ignored
    });

    expect(res.ok).toBe(true);
    const [message] = await inbox;
    expect(message.content).toBe('Hello!');
    expect(message.sender._id).toBe(client.user.id);
    expect(await personal).toHaveLength(1);

    const stored = await Message.findOne({ conversation: conversationId });
    expect(stored!.sender.toString()).toBe(client.user.id);
    const conversation = await Conversation.findById(conversationId);
    expect(conversation!.lastMessage!.toString()).toBe(stored!.id);
  });

  it('rejects malformed payloads', async () => {
    const { client, conversationId } = await setup();
    const socket = await connect(client.token);
    expect((await emitAck(socket, 'send_message', { conversationId, content: '' })).ok).toBe(false);
    expect((await emitAck(socket, 'send_message', { conversationId: 'x', content: 'hi' })).ok).toBe(false);
  });

  it('typing events reach only joined participants', async () => {
    const { client, freelancer, outsider, conversationId } = await setup();
    const receiver = await connect(freelancer.token);
    await emitAck(receiver, 'join_conversation', { conversationId });
    const typing = collect(receiver, 'typing');

    const attacker = await connect(outsider.token);
    attacker.emit('typing', { conversationId });

    const sender = await connect(client.token);
    await emitAck(sender, 'join_conversation', { conversationId });
    sender.emit('typing', { conversationId });

    expect(await typing).toEqual([{ conversationId, userId: client.user.id }]);
  });
});
