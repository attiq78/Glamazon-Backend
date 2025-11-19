const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const auth = require('../middleware/auth');

// Dashboard routes
router.get('/stats', auth, dashboardController.getDashboardStats);
router.get('/data-hash', auth, dashboardController.getDataHash);
router.get('/real-time-updates', auth, dashboardController.getRealTimeUpdates);

module.exports = router; 