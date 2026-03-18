const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const crypto = require('crypto');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public / Admin
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, studentId, department } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password, role: role || 'student', studentId, department });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        faceRegistered: user.faceRegistered,
        fingerprintRegistered: user.fingerprintRegistered,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        studentId: user.studentId,
        profileImage: user.profileImage,
        faceRegistered: user.faceRegistered,
        fingerprintRegistered: user.fingerprintRegistered,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// @desc    Register WebAuthn / Fingerprint - Begin
// @route   POST /api/auth/webauthn/register/begin
// @access  Private
const webauthnRegisterBegin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const challenge = crypto.randomBytes(32).toString('base64url');

    // Store challenge temporarily (in production use Redis/session)
    user._challenge = challenge;

    const options = {
      challenge,
      rp: { name: 'Smart Attendance', id: process.env.RP_ID || 'localhost' },
      user: {
        id: Buffer.from(user._id.toString()).toString('base64url'),
        name: user.email,
        displayName: user.name,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      timeout: 60000,
      attestation: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
    };

    // Store challenge in user document temporarily
    await User.findByIdAndUpdate(req.user.id, {
      'fingerprintCredential.challenge': challenge,
    });

    res.json({ success: true, options });
  } catch (error) {
    next(error);
  }
};

// @desc    Register WebAuthn - Complete
// @route   POST /api/auth/webauthn/register/complete
// @access  Private
const webauthnRegisterComplete = async (req, res, next) => {
  try {
    const { credentialId, publicKey, counter } = req.body;

    await User.findByIdAndUpdate(req.user.id, {
      fingerprintCredential: { credentialId, publicKey, counter: counter || 0 },
      fingerprintRegistered: true,
    });

    res.json({ success: true, message: 'Fingerprint registered successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    WebAuthn Login - Begin
// @route   POST /api/auth/webauthn/login/begin
// @access  Public
const webauthnLoginBegin = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email, fingerprintRegistered: true });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found or fingerprint not registered' });
    }

    const challenge = crypto.randomBytes(32).toString('base64url');

    const options = {
      challenge,
      timeout: 60000,
      userVerification: 'required',
      allowCredentials: [{
        id: user.fingerprintCredential.credentialId,
        type: 'public-key',
        transports: ['internal'],
      }],
    };

    await User.findByIdAndUpdate(user._id, {
      'fingerprintCredential.challenge': challenge,
    });

    res.json({ success: true, options, userId: user._id });
  } catch (error) {
    next(error);
  }
};

// @desc    WebAuthn Login - Complete
// @route   POST /api/auth/webauthn/login/complete
// @access  Public
const webauthnLoginComplete = async (req, res, next) => {
  try {
    const { userId, credentialId } = req.body;

    const user = await User.findOne({
      _id: userId,
      'fingerprintCredential.credentialId': credentialId,
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication failed' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Fingerprint authentication successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        faceRegistered: user.faceRegistered,
        fingerprintRegistered: user.fingerprintRegistered,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  webauthnRegisterBegin,
  webauthnRegisterComplete,
  webauthnLoginBegin,
  webauthnLoginComplete,
};
