const Attendance = require('../models/Attendance');
const Session = require('../models/Session');
const Class = require('../models/Class');
const User = require('../models/User');
const { stringify } = require('csv-stringify/sync');

// @desc    Mark attendance via face recognition
// @route   POST /api/attendance/mark
// @access  Private (Student)
const markAttendance = async (req, res, next) => {
  try {
    const { sessionId, faceDescriptor, confidence, method = 'face' } = req.body;
    const studentId = req.user.id;

    // Validate session
    const session = await Session.findById(sessionId).populate('classId');
    if (!session || !session.active) {
      return res.status(400).json({ success: false, message: 'No active session found' });
    }

    // Check if student belongs to class
    const classDoc = session.classId;
    const isEnrolled = classDoc.students.some(s => s.toString() === studentId.toString());
    if (!isEnrolled) {
      return res.status(403).json({ success: false, message: 'You are not enrolled in this class' });
    }

    // Check attendance window
    const sessionStart = new Date(session.startTime);
    const now = new Date();
    const minutesElapsed = (now - sessionStart) / (1000 * 60);

    let status = 'present';
    if (minutesElapsed > session.attendanceWindow) {
      status = 'late';
    }

    // Check duplicate attendance
    const existing = await Attendance.findOne({ studentId, sessionId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Attendance already marked for this session' });
    }

    // Validate face if method is face
    if (method === 'face') {
      const student = await User.findById(studentId);
      if (!student.faceRegistered || !student.faceDescriptor || !student.faceDescriptor.length) {
        return res.status(400).json({ success: false, message: 'Face not registered. Please register your face first.' });
      }

      if (confidence < 50) {
        return res.status(400).json({ success: false, message: `Face match confidence too low: ${confidence.toFixed(1)}%` });
      }
    }

    // Mark attendance
    const attendance = await Attendance.create({
      studentId,
      classId: classDoc._id,
      sessionId,
      date: new Date().setHours(0, 0, 0, 0),
      time: new Date().toLocaleTimeString(),
      status,
      method,
      confidence,
    });

    await attendance.populate('studentId', 'name email studentId profileImage');

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`session-${sessionId}`).emit('attendance-marked', {
        attendance,
        student: attendance.studentId,
      });
      io.to(`class-${classDoc._id}`).emit('attendance-update', {
        sessionId,
        count: await Attendance.countDocuments({ sessionId }),
      });
    }

    res.status(201).json({
      success: true,
      message: `Attendance marked as ${status}`,
      attendance,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student's attendance for a class
// @route   GET /api/attendance/student/:classId
// @access  Private (Student)
const getStudentAttendance = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const studentId = req.user.id;

    const sessions = await Session.find({ classId });
    const totalSessions = sessions.length;

    const attendance = await Attendance.find({ studentId, classId })
      .populate('sessionId', 'title date startTime')
      .sort('-date');

    const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
    const percentage = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

    res.json({
      success: true,
      data: {
        attendance,
        stats: {
          totalSessions,
          present: presentCount,
          absent: totalSessions - presentCount,
          percentage,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all student's attendance summary
// @route   GET /api/attendance/my-summary
// @access  Private (Student)
const getMyAttendanceSummary = async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const classes = await Class.find({ students: studentId }).populate('teacherId', 'name');
    
    const summary = await Promise.all(classes.map(async (cls) => {
      const sessions = await Session.find({ classId: cls._id });
      const totalSessions = sessions.length;
      const attended = await Attendance.countDocuments({
        studentId,
        classId: cls._id,
        status: { $in: ['present', 'late'] },
      });
      const percentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;

      return {
        class: { id: cls._id, name: cls.className, code: cls.classCode, teacher: cls.teacherId?.name },
        totalSessions,
        attended,
        absent: totalSessions - attended,
        percentage,
        belowThreshold: percentage < cls.attendanceThreshold,
      };
    }));

    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

// @desc    Get session attendance (Teacher)
// @route   GET /api/attendance/session/:sessionId
// @access  Private (Teacher/Admin)
const getSessionAttendance = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId).populate('classId', 'className students');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const attendance = await Attendance.find({ sessionId })
      .populate('studentId', 'name email studentId profileImage');

    const totalStudents = session.classId.students.length;
    const presentStudents = attendance.filter(a => a.status === 'present' || a.status === 'late');

    res.json({
      success: true,
      data: {
        session,
        attendance,
        stats: {
          total: totalStudents,
          present: presentStudents.length,
          absent: totalStudents - presentStudents.length,
          percentage: totalStudents > 0 ? Math.round((presentStudents.length / totalStudents) * 100) : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get class attendance report
// @route   GET /api/attendance/class/:classId/report
// @access  Private (Teacher/Admin)
const getClassAttendanceReport = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { startDate, endDate } = req.query;

    const classDoc = await Class.findById(classId).populate('students', 'name email studentId');
    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const sessions = await Session.find({
      classId,
      ...(Object.keys(dateFilter).length && { date: dateFilter }),
    }).sort('date');

    const report = await Promise.all(classDoc.students.map(async (student) => {
      const attendanceRecords = await Attendance.find({
        studentId: student._id,
        classId,
        ...(Object.keys(dateFilter).length && { date: dateFilter }),
      }).populate('sessionId', 'date title');

      const present = attendanceRecords.filter(a => a.status === 'present' || a.status === 'late').length;
      const percentage = sessions.length > 0 ? Math.round((present / sessions.length) * 100) : 0;

      return {
        student: { id: student._id, name: student.name, email: student.email, studentId: student.studentId },
        totalSessions: sessions.length,
        present,
        absent: sessions.length - present,
        percentage,
        records: attendanceRecords,
      };
    }));

    res.json({
      success: true,
      data: { class: classDoc, sessions, report },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export attendance as CSV
// @route   GET /api/attendance/class/:classId/export
// @access  Private (Teacher/Admin)
const exportAttendanceCSV = async (req, res, next) => {
  try {
    const { classId } = req.params;

    const classDoc = await Class.findById(classId).populate('students', 'name email studentId');
    const sessions = await Session.find({ classId }).sort('date');

    const rows = [['Student Name', 'Student ID', 'Email', ...sessions.map(s => new Date(s.date).toLocaleDateString()), 'Total Present', 'Percentage']];

    for (const student of classDoc.students) {
      const attendanceRecords = await Attendance.find({ studentId: student._id, classId });
      const sessionMap = {};
      attendanceRecords.forEach(a => { sessionMap[a.sessionId.toString()] = a.status; });

      const sessionStatuses = sessions.map(s => sessionMap[s._id.toString()] || 'absent');
      const presentCount = sessionStatuses.filter(s => s === 'present' || s === 'late').length;
      const percentage = sessions.length > 0 ? `${Math.round((presentCount / sessions.length) * 100)}%` : '0%';

      rows.push([student.name, student.studentId || '', student.email, ...sessionStatuses, presentCount, percentage]);
    }

    const csv = stringify(rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${classDoc.className}-attendance.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

// @desc    Register face descriptor
// @route   POST /api/attendance/register-face
// @access  Private (Student)
const registerFace = async (req, res, next) => {
  try {
    const { faceDescriptor } = req.body;

    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return res.status(400).json({ success: false, message: 'Invalid face descriptor. Must be a 128-dimensional array.' });
    }

    await User.findByIdAndUpdate(req.user.id, {
      faceDescriptor,
      faceRegistered: true,
    });

    res.json({ success: true, message: 'Face registered successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get face descriptor for matching (same student)
// @route   GET /api/attendance/face-descriptor
// @access  Private (Student)
const getMyFaceDescriptor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('faceDescriptor faceRegistered');
    res.json({
      success: true,
      faceRegistered: user.faceRegistered,
      faceDescriptor: user.faceDescriptor,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manual attendance override
// @route   PUT /api/attendance/:id
// @access  Private (Teacher/Admin)
const updateAttendance = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const attendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      { status, notes, markedBy: req.user.id },
      { new: true }
    ).populate('studentId', 'name email');

    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    res.json({ success: true, data: attendance });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  markAttendance,
  getStudentAttendance,
  getMyAttendanceSummary,
  getSessionAttendance,
  getClassAttendanceReport,
  exportAttendanceCSV,
  registerFace,
  getMyFaceDescriptor,
  updateAttendance,
};
