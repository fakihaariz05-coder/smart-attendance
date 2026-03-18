const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] },
  startTime: String,
  endTime: String,
  room: String,
});

const classSchema = new mongoose.Schema({
  className: {
    type: String,
    required: [true, 'Class name is required'],
    trim: true,
  },
  classCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
  },
  description: String,
  department: String,
  semester: String,
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  schedule: [scheduleSchema],
  attendanceThreshold: {
    type: Number,
    default: 75,
    min: 0,
    max: 100,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  qrCode: String,
}, { timestamps: true });

// Virtual: student count
classSchema.virtual('studentCount').get(function () {
  return this.students.length;
});

classSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Class', classSchema);
