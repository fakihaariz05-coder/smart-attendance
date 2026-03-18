const express = require('express');
const router = express.Router();
const { createClass, getClasses, getClass, updateClass, deleteClass, addStudent, removeStudent, joinClass } = require('../controllers/classController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', getClasses);
router.post('/', authorize('teacher', 'admin'), createClass);
router.post('/join', authorize('student'), joinClass);
router.get('/:id', getClass);
router.put('/:id', authorize('teacher', 'admin'), updateClass);
router.delete('/:id', authorize('admin'), deleteClass);
router.post('/:id/students', authorize('teacher', 'admin'), addStudent);
router.delete('/:id/students/:studentId', authorize('teacher', 'admin'), removeStudent);

module.exports = router;
