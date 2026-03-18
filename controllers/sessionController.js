const Session = require('../models/Session');
const Class = require('../models/Class');
const QRCode = require('qrcode');

// @desc    Start a session
// @route   POST /api/sessions
// @access  Private (Teacher)
const startSession = async (req, res, next) => {
  try {
    const { classId, title, attendanceWindow } = req.body;

    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (req.user.role === 'teacher' && classDoc.teacherId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized for this class' });
    }

    // Check if active session exists
    const existingSession = await Session.findOne({ classId, active: true });
    if (existingSession) {
      return res.status(400).json({ success: false, message: 'A session is already active for this class' });
    }

    const qrData = JSON.stringify({ type: 'attendance', classId, timestamp: Date.now() });
    const qrCode = await QRCode.toDataURL(qrData);

    const session = await Session.create({
      classId,
      teacherId: req.user.id,
      title: title || 'Regular Class',
      date: new Date().setHours(0, 0, 0, 0),
      startTime: new Date(),
      active: true,
      attendanceWindow: attendanceWindow || 15,
      qrCode,
    });

    await session.populate('classId', 'className classCode students');

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.to(`class-${classId}`).emit('session-started', { session });
    }

    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

// @desc    End a session
// @route   PUT /api/sessions/:id/end
// @access  Private (Teacher)
const endSession = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (req.user.role === 'teacher' && session.teacherId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    session.active = false;
    session.endTime = new Date();
    await session.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`session-${session._id}`).emit('session-ended', { sessionId: session._id });
      io.to(`class-${session.classId}`).emit('session-ended', { sessionId: session._id });
    }

    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

// @desc    Get sessions for a class
// @route   GET /api/sessions/class/:classId
// @access  Private
const getClassSessions = async (req, res, next) => {
  try {
    const sessions = await Session.find({ classId: req.params.classId })
      .sort('-date')
      .populate('teacherId', 'name');

    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
};

// @desc    Get active session for a class
// @route   GET /api/sessions/active/:classId
// @access  Private
const getActiveSession = async (req, res, next) => {
  try {
    const session = await Session.findOne({ classId: req.params.classId, active: true });
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all active sessions
// @route   GET /api/sessions/active
// @access  Private (Student)
const getAllActiveSessions = async (req, res, next) => {
  try {
    const studentClasses = await Class.find({ students: req.user.id }).select('_id');
    const classIds = studentClasses.map(c => c._id);

    const sessions = await Session.find({ classId: { $in: classIds }, active: true })
      .populate('classId', 'className classCode')
      .populate('teacherId', 'name');

    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
};

module.exports = { startSession, endSession, getClassSessions, getActiveSession, getAllActiveSessions };
