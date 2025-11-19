const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const auth = require('../middleware/auth');

router.get('/available-slots', appointmentController.getAvailableSlots);
router.post('/book', auth, appointmentController.bookAppointment);
router.get('/', auth, appointmentController.getAppointments);
router.get('/admin', auth, appointmentController.getAdminAppointments);
router.post('/:appointmentId/cancel', auth, appointmentController.cancelAppointment);
router.delete('/:appointmentId', auth, appointmentController.deleteAppointment);

module.exports = router; 