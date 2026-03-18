const express = require('express');
const router = express.Router();
const { getAdminOverview, getTeacherAnalytics, getStudentAnalytics } = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/overview', authorize('admin'), getAdminOverview);
router.get('/teacher', authorize('teacher'), getTeacherAnalytics);
router.get('/student', authorize('student'), getStudentAnalytics);

module.exports = router;
