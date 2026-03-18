const Class = require('../models/Class');
const User = require('../models/User');
const Session = require('../models/Session');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

// @desc    Create class
// @route   POST /api/classes
// @access  Private (Teacher/Admin)
const createClass = async (req, res, next) => {
  try {
    const { className, description, department, semester, schedule, attendanceThreshold } = req.body;

    const classCode = uuidv4().substring(0, 8).toUpperCase();
    const qrData = JSON.stringify({ classCode, type: 'class-join' });
    const qrCode = await QRCode.toDataURL(qrData);

    const newClass = await Class.create({
      className,
      classCode,
      description,
      department,
      semester,
      schedule,
      attendanceThreshold,
      teacherId: req.user.id,
      qrCode,
    });

    await newClass.populate('teacherId', 'name email');

    res.status(201).json({ success: true, data: newClass });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all classes (filtered by role)
// @route   GET /api/classes
// @access  Private
const getClasses = async (req, res, next) => {
  try {
    let query = {};

    if (req.user.role === 'teacher') {
      query.teacherId = req.user.id;
    } else if (req.user.role === 'student') {
      query.students = req.user.id;
    }

    const classes = await Class.find(query)
      .populate('teacherId', 'name email')
      .populate('students', 'name email studentId profileImage')
      .sort('-createdAt');

    res.json({ success: true, count: classes.length, data: classes });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single class
// @route   GET /api/classes/:id
// @access  Private
const getClass = async (req, res, next) => {
  try {
    const classDoc = await Class.findById(req.params.id)
      .populate('teacherId', 'name email department')
      .populate('students', 'name email studentId profileImage department');

    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    res.json({ success: true, data: classDoc });
  } catch (error) {
    next(error);
  }
};

// @desc    Update class
// @route   PUT /api/classes/:id
// @access  Private (Teacher/Admin)
const updateClass = async (req, res, next) => {
  try {
    const classDoc = await Class.findById(req.params.id);

    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (req.user.role === 'teacher' && classDoc.teacherId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this class' });
    }

    const updated = await Class.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('teacherId', 'name email');

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete class
// @route   DELETE /api/classes/:id
// @access  Private (Admin)
const deleteClass = async (req, res, next) => {
  try {
    const classDoc = await Class.findByIdAndDelete(req.params.id);

    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    res.json({ success: true, message: 'Class deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Add student to class
// @route   POST /api/classes/:id/students
// @access  Private (Teacher/Admin)
const addStudent = async (req, res, next) => {
  try {
    const { studentId } = req.body;

    const classDoc = await Class.findById(req.params.id);
    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const student = await User.findOne({ _id: studentId, role: 'student' });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (classDoc.students.includes(studentId)) {
      return res.status(400).json({ success: false, message: 'Student already enrolled' });
    }

    classDoc.students.push(studentId);
    await classDoc.save();

    await classDoc.populate('students', 'name email studentId');

    res.json({ success: true, message: 'Student added successfully', data: classDoc });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove student from class
// @route   DELETE /api/classes/:id/students/:studentId
// @access  Private (Teacher/Admin)
const removeStudent = async (req, res, next) => {
  try {
    const classDoc = await Class.findById(req.params.id);
    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    classDoc.students = classDoc.students.filter(
      s => s.toString() !== req.params.studentId
    );
    await classDoc.save();

    res.json({ success: true, message: 'Student removed successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Join class via code
// @route   POST /api/classes/join
// @access  Private (Student)
const joinClass = async (req, res, next) => {
  try {
    const { classCode } = req.body;

    const classDoc = await Class.findOne({ classCode: classCode.toUpperCase() });
    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Invalid class code' });
    }

    if (classDoc.students.includes(req.user.id)) {
      return res.status(400).json({ success: false, message: 'Already enrolled in this class' });
    }

    classDoc.students.push(req.user.id);
    await classDoc.save();

    res.json({ success: true, message: 'Joined class successfully', data: classDoc });
  } catch (error) {
    next(error);
  }
};

module.exports = { createClass, getClasses, getClass, updateClass, deleteClass, addStudent, removeStudent, joinClass };
