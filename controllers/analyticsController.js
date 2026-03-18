const User = require('../models/User');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const Session = require('../models/Session');

// @desc    Admin analytics overview
// @route   GET /api/analytics/overview
// @access  Private (Admin)
const getAdminOverview = async (req, res, next) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student', isActive: true });
    const totalTeachers = await User.countDocuments({ role: 'teacher', isActive: true });
    const totalClasses = await Class.countDocuments({ isActive: true });
    const totalSessions = await Session.countDocuments();

    const totalAttendance = await Attendance.countDocuments({ status: { $in: ['present', 'late'] } });
    const totalPossible = await Attendance.countDocuments();
    const overallAttendanceRate = totalPossible > 0 ? Math.round((totalAttendance / totalPossible) * 100) : 0;

    // Monthly attendance trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await Attendance.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, status: { $in: ['present', 'late'] } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Top classes by attendance
    const topClasses = await Attendance.aggregate([
      { $match: { status: { $in: ['present', 'late'] } } },
      { $group: { _id: '$classId', present: { $sum: 1 } } },
      { $sort: { present: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'classes', localField: '_id', foreignField: '_id', as: 'class' } },
      { $unwind: '$class' },
      { $project: { className: '$class.className', present: 1 } },
    ]);

    // Recent activity
    const recentAttendance = await Attendance.find()
      .sort('-createdAt')
      .limit(10)
      .populate('studentId', 'name')
      .populate('classId', 'className');

    res.json({
      success: true,
      data: {
        stats: { totalStudents, totalTeachers, totalClasses, totalSessions, overallAttendanceRate },
        monthlyTrend,
        topClasses,
        recentAttendance,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Teacher analytics
// @route   GET /api/analytics/teacher
// @access  Private (Teacher)
const getTeacherAnalytics = async (req, res, next) => {
  try {
    const teacherId = req.user.id;

    const classes = await Class.find({ teacherId });
    const classIds = classes.map(c => c._id);

    const totalStudents = classes.reduce((sum, c) => sum + c.students.length, 0);
    const totalSessions = await Session.countDocuments({ teacherId });

    // Per-class attendance rates
    const classStats = await Promise.all(classes.map(async (cls) => {
      const sessions = await Session.find({ classId: cls._id });
      const totalPossible = sessions.length * cls.students.length;
      const present = await Attendance.countDocuments({
        classId: cls._id,
        status: { $in: ['present', 'late'] },
      });
      const rate = totalPossible > 0 ? Math.round((present / totalPossible) * 100) : 0;

      return {
        id: cls._id,
        name: cls.className,
        sessions: sessions.length,
        students: cls.students.length,
        attendanceRate: rate,
      };
    }));

    // Weekly trend
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weeklyTrend = await Session.find({
      teacherId,
      date: { $gte: sevenDaysAgo },
    }).populate('classId', 'className');

    res.json({
      success: true,
      data: { totalStudents, totalSessions, classStats, weeklyTrend },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Student analytics
// @route   GET /api/analytics/student
// @access  Private (Student)
const getStudentAnalytics = async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const classes = await Class.find({ students: studentId });

    const analytics = await Promise.all(classes.map(async (cls) => {
      const sessions = await Session.find({ classId: cls._id });
      const attended = await Attendance.countDocuments({
        studentId,
        classId: cls._id,
        status: { $in: ['present', 'late'] },
      });
      const rate = sessions.length > 0 ? Math.round((attended / sessions.length) * 100) : 0;
      return { className: cls.className, classId: cls._id, attended, total: sessions.length, rate };
    }));

    // Monthly breakdown
    const monthlyData = await Attendance.aggregate([
      { $match: { studentId: require('mongoose').Types.ObjectId.createFromHexString(studentId.toString()) } },
      {
        $group: {
          _id: { year: { $year: '$date' }, month: { $month: '$date' } },
          present: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({ success: true, data: { classBreakdown: analytics, monthlyData } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAdminOverview, getTeacherAnalytics, getStudentAnalytics };
