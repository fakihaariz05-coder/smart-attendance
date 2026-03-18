const express = require('express');
const router = express.Router();
const { startSession, endSession, getClassSessions, getActiveSession, getAllActiveSessions } = require('../controllers/sessionController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.post('/', authorize('teacher', 'admin'), startSession);
router.get('/active', authorize('student'), getAllActiveSessions);
router.get('/active/:classId', getActiveSession);
router.get('/class/:classId', getClassSessions);
router.put('/:id/end', authorize('teacher', 'admin'), endSession);

module.exports = router;
