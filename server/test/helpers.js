import './setup-env.js';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import request from 'supertest';
import { io as connect } from 'socket.io-client';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { initSocket } from '../src/socket.js';
import { User } from '../src/models/index.js';

export const CP = { address: 'Connaught Place, New Delhi', lat: 28.6315, lng: 77.2167 };
export const GATE = { address: 'India Gate, New Delhi', lat: 28.6129, lng: 77.2295 };
export const orderBody = (extra = {}) => ({ pickup: CP, drop: GATE, packageDescription: 'Test parcel', ...extra });

/** Boots the real API + WebSocket server on a random port with a throwaway in-memory MongoDB. */
export async function startTestServer() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('test'));
  const app = createApp();
  const server = http.createServer(app);
  const io = initSocket(server);
  app.set('io', io);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const sockets = [];

  return {
    app,
    url,
    api: () => request(app),
    /** Creates a user directly in the DB and returns { user, token, auth }. */
    async makeUser({ name, email, role = 'user', ...rest }) {
      const user = await User.create({ name, email, role, password: await bcrypt.hash('password123', 4), ...rest });
      const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
      return { user, token: res.body.token, auth: { Authorization: `Bearer ${res.body.token}` } };
    },
    /** Opens an authenticated socket; resolves once connected. */
    async socket(token) {
      const s = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false });
      sockets.push(s);
      await new Promise((resolve, reject) => {
        s.once('connect', resolve);
        s.once('connect_error', reject);
      });
      return s;
    },
    async stop() {
      sockets.forEach((s) => s.disconnect());
      await new Promise((resolve) => io.close(resolve));
      await mongoose.disconnect();
      await mongod.stop();
    },
  };
}

/** Resolves with the first payload of `event`, or rejects after `ms`. */
export const nextEvent = (socket, event, ms = 2000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), ms);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

/** Resolves true if `event` does NOT arrive within `ms`. */
export const noEvent = (socket, event, ms = 400) =>
  new Promise((resolve) => {
    const handler = () => resolve(false);
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve(true);
    }, ms);
  });
