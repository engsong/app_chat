"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const api_js_1 = require("./routes/api.js");
const socketHandler_js_1 = require("./sockets/socketHandler.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
// Middleware
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Public static assets
app.use(express_1.default.static(path_1.default.resolve(process.cwd(), 'public')));
// Health Check
app.get(['/health', '/api/health'], (req, res) => {
    res.json({
        status: 'ok',
        service: 'IChat API & Realtime Gateway',
        timestamp: new Date(),
    });
});
// REST API
app.use('/api', api_js_1.apiRouter);
// Socket.io with low latency config
exports.io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    transports: ['websocket', 'polling'],
});
// Setup Real-time Chat and WebRTC Signaling
(0, socketHandler_js_1.setupSocketHandlers)(exports.io);
server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`⚡ IChat Ultra-Fast Real-Time Server running!`);
    console.log(`📡 HTTP & REST API:   http://localhost:${PORT}`);
    console.log(`🔊 WebRTC Signaling:  ws://localhost:${PORT}`);
    console.log(`💬 Frontend Proxy:    ${CLIENT_URL}`);
    console.log(`======================================================\n`);
});
