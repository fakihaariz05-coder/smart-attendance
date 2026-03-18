const express = require('express');
const router = express.Router();
const { getUsers, getUser, updateUser, deleteUser, toggleUserStatus, uploadProfileImage, changePassword } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', authorize('admin'), getUsers);
router.get('/:id', authorize('admin'), getUser);
router.put('/change-password', changePassword);
router.post('/upload-image', uploadProfileImage);
router.put('/:id', updateUser);
router.delete('/:id', authorize('admin'), deleteUser);
router.put('/:id/toggle-status', authorize('admin'), toggleUserStatus);

module.exports = router;
