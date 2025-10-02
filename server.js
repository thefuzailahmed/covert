// server.js
require('dotenv').config(); // Load environment variables from .env

const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ===== MongoDB Setup =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

const messageSchema = new mongoose.Schema({
  roomKey: String,
  username: String,
  text: String,
  ts: { type: Date, default: Date.now },
});

const roomSchema = new mongoose.Schema({
  key: String,
  name: String,
});

const Message = mongoose.model("Message", messageSchema);
const Room = mongoose.model("Room", roomSchema);

// ===== Utility =====
function makeRoomKey() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// ===== REST APIs =====

// Create new room
app.post('/create-room', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Room name required' });

  let roomKey;
  do {
    roomKey = makeRoomKey();
  } while (await Room.findOne({ key: roomKey }));

  await Room.create({ key: roomKey, name: name.trim() });

  res.json({ roomKey });
});

// Check room existence
app.get('/room/:roomKey', async (req, res) => {
  const { roomKey } = req.params;
  const room = await Room.findOne({ key: roomKey });
  if (room) {
    res.json({ exists: true, name: room.name });
  } else {
    res.json({ exists: false });
  }
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// ===== Socket.IO =====
io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  // join-room
  socket.on('join-room', async ({ roomKey, username }, cb) => {
    try {
      const room = await Room.findOne({ key: roomKey });
      if (!room) {
        if (cb) cb({ ok: false, err: 'Room not found' });
        return;
      }

      socket.join(roomKey);

      // fetch last 30 messages for this room
      const messages = await Message.find({ roomKey })
        .sort({ ts: -1 })
        .limit(30)
        .lean();

      socket.emit('init', {
        roomKey,
        roomName: room.name,
        messages: messages.reverse(), // oldest first
      });

      socket.to(roomKey).emit('user-joined', { username });

      if (cb) cb({ ok: true });
    } catch (err) {
      console.error(err);
      if (cb) cb({ ok: false, err: 'Server error' });
    }
  });

  // send-message
  socket.on('send-message', async ({ roomKey, username, text }, cb) => {
    try {
      const room = await Room.findOne({ key: roomKey });
      if (!room) {
        if (cb) cb({ ok: false, err: 'Room not found' });
        return;
      }

      const msg = await Message.create({ roomKey, username, text });
      const data = {
        id: msg._id,
        username,
        text,
        ts: msg.ts,
      };

      io.in(roomKey).emit('new-message', data);
      if (cb) cb({ ok: true });
    } catch (err) {
      console.error(err);
      if (cb) cb({ ok: false, err: 'Server error' });
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Covert server running ➜ http://0.0.0.0:${PORT}`);
});
