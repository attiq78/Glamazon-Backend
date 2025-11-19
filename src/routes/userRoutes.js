const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

// Public routes
router.post('/initiate-signup', userController.initiateSignup);
router.post('/verify-otp-signup', userController.verifyOtpAndSignup);
router.post('/login', userController.login);
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password', userController.resetPassword);

// Protected routes
router.get('/profile', auth, userController.getProfile);
router.put('/profile', auth, userController.updateProfile);
router.get('/stats', auth, userController.getUserStats);
router.post('/change-password', auth, userController.changePassword);
router.post('/heartbeat', auth, userController.heartbeat);

// Admin routes
router.get('/all', auth, userController.getAllUsers);
router.post('/create', auth, userController.createUser);
router.get('/dashboard-stats', auth, userController.getDashboardStats);
router.delete('/:userId', auth, userController.deleteUser);
router.get('/status/:userId', auth, userController.getUserStatus);

module.exports = router; 