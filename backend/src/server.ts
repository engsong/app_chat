import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiRouter } from './routes/api.js';
import { setupSocketHandlers } from './sockets/socketHandler.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'WhatsApp Business API & Realtime Gateway',
    timestamp: new Date(),
  });
});

// REST API
app.use('/api', apiRouter);

// Socket.io with low latency config
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling'],
});

// Setup Real-time Chat and WebRTC Signaling
setupSocketHandlers(io);

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`⚡ WhatsApp Business Ultra-Fast Real-Time Server running!`);
  console.log(`📡 HTTP & REST API:   http://localhost:${PORT}`);
  console.log(`🔊 WebRTC Signaling:  ws://localhost:${PORT}`);
  console.log(`💬 Frontend Proxy:    ${CLIENT_URL}`);
  console.log(`======================================================\n`);
});
