const express = require('express');
const router = express.Router();
const {
  markAttendance, getStudentAttendance, getMyAttendanceSummary,
  getSessionAttendance, getClassAttendanceReport, exportAttendanceCSV,
  registerFace, getMyFaceDescriptor, updateAttendance,
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');
const { attendanceLimiter } = require('../middleware/rateLimiter');

router.use(protect);

router.post('/mark', attendanceLimiter, markAttendance);
router.post('/register-face', registerFace);
router.get('/face-descriptor', getMyFaceDescriptor);
router.get('/my-summary', authorize('student'), getMyAttendanceSummary);
router.get('/student/:classId', authorize('student'), getStudentAttendance);
router.get('/session/:sessionId', authorize('teacher', 'admin'), getSessionAttendance);
router.get('/class/:classId/report', authorize('teacher', 'admin'), getClassAttendanceReport);
router.get('/class/:classId/export', authorize('teacher', 'admin'), exportAttendanceCSV);
router.put('/:id', authorize('teacher', 'admin'), updateAttendance);

module.exports = router;
