require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const path = require('path');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const classRoutes = require('./routes/classes');
const attendanceRoutes = require('./routes/attendance');
const sessionRoutes = require('./routes/sessions');
const analyticsRoutes = require('./routes/analytics');

const { errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io available in routes
app.set('io', io);

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting
app.use('/api/', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

// Error handler
app.use(errorHandler);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-session', (sessionId) => {
    socket.join(`session-${sessionId}`);
    console.log(`Socket ${socket.id} joined session-${sessionId}`);
  });

  socket.on('join-class', (classId) => {
    socket.join(`class-${classId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-attendance')
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = { app, io };
