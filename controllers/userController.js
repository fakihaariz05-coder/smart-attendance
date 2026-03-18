const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = process.env.UPLOAD_PATH || './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
}).single('profileImage');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin)
const getUsers = async (req, res, next) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort('-createdAt');

    res.json({
      success: true,
      count: users.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Admin)
const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin / Own profile)
const updateUser = async (req, res, next) => {
  try {
    const { name, email, department, studentId } = req.body;

    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const updateData = { name, email, department, studentId };
    if (req.user.role === 'admin' && req.body.role) {
      updateData.role = req.body.role;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin)
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle user active status
// @route   PUT /api/users/:id/toggle-status
// @access  Private (Admin)
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}`, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload profile image
// @route   POST /api/users/upload-image
// @access  Private
const uploadProfileImage = (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    try {
      const imageUrl = `/uploads/${req.file.filename}`;
      await User.findByIdAndUpdate(req.user.id, { profileImage: imageUrl });
      res.json({ success: true, imageUrl });
    } catch (error) {
      next(error);
    }
  });
};

// @desc    Change password
// @route   PUT /api/users/change-password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, getUser, updateUser, deleteUser, toggleUserStatus, uploadProfileImage, changePassword };
