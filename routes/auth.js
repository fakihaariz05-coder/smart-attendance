// routes/auth.js
const express = require('express');
const router = express.Router();
const { register, login, getMe, webauthnRegisterBegin, webauthnRegisterComplete, webauthnLoginBegin, webauthnLoginComplete } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', protect, getMe);
router.post('/webauthn/register/begin', protect, webauthnRegisterBegin);
router.post('/webauthn/register/complete', protect, webauthnRegisterComplete);
router.post('/webauthn/login/begin', authLimiter, webauthnLoginBegin);
router.post('/webauthn/login/complete', authLimiter, webauthnLoginComplete);

module.exports = router;
