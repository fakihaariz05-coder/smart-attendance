const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    default: 'Regular Class',
  },
  date: {
    type: Date,
    required: true,
    default: () => new Date().setHours(0,0,0,0),
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: Date,
  active: {
    type: Boolean,
    default: true,
  },
  qrCode: String,
  attendanceWindow: {
    type: Number,
    default: 15, // minutes after start
  },
  notes: String,
}, { timestamps: true });

sessionSchema.index({ classId: 1, date: 1 });
sessionSchema.index({ active: 1, classId: 1 });

module.exports = mongoose.model('Session', sessionSchema);
