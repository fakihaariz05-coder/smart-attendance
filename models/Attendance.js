const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  },
  date: {
    type: Date,
    required: true,
    default: () => new Date().setHours(0,0,0,0),
  },
  time: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'excused'],
    default: 'present',
  },
  method: {
    type: String,
    enum: ['face', 'fingerprint', 'qr', 'manual'],
    default: 'face',
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100,
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  notes: String,
}, { timestamps: true });

// Compound index to prevent duplicate attendance per student per session
attendanceSchema.index({ studentId: 1, sessionId: 1 }, { unique: true });
attendanceSchema.index({ classId: 1, date: 1 });
attendanceSchema.index({ studentId: 1, classId: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
