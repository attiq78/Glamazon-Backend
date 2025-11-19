const User = require('../models/User');
const Appointment = require('../models/Appointment');

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalAppointments,
      upcomingAppointments,
      todayAppointments,
      cancelledAppointments
    ] = await Promise.all([
      User.countDocuments({ type: 'client' }),
      Appointment.countDocuments(),
      Appointment.countDocuments({
        date: { $gte: new Date().toISOString().split('T')[0] },
        status: { $in: ['confirmed', 'approved'] }
      }),
      Appointment.countDocuments({
        date: new Date().toISOString().split('T')[0]
      }),
      Appointment.countDocuments({ status: 'cancelled' })
    ]);

    res.json({
      stats: {
        totalUsers,
        totalAppointments,
        upcomingAppointments,
        todayAppointments,
        cancelledAppointments
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
};

// Get lightweight data for change detection
const getDataHash = async (req, res) => {
  try {
    const [userCount, appointmentCount, latestAppointment] = await Promise.all([
      User.countDocuments(),
      Appointment.countDocuments(),
      Appointment.findOne().sort({ updatedAt: -1 }).select('updatedAt')
    ]);

    // Create a hash of the data for change detection
    const dataHash = {
      userCount,
      appointmentCount,
      latestUpdate: latestAppointment ? latestAppointment.updatedAt : new Date(0)
    };

    res.json({ dataHash });
  } catch (error) {
    console.error('Error fetching data hash:', error);
    res.status(500).json({ error: 'Failed to fetch data hash' });
  }
};

// Get real-time updates
const getRealTimeUpdates = async (req, res) => {
  try {
    const { lastUpdate } = req.query;
    const lastUpdateDate = lastUpdate ? new Date(lastUpdate) : new Date(0);

    const [newUsers, updatedAppointments] = await Promise.all([
      User.find({ createdAt: { $gt: lastUpdateDate } }).countDocuments(),
      Appointment.find({ updatedAt: { $gt: lastUpdateDate } }).countDocuments()
    ]);

    res.json({
      hasUpdates: newUsers > 0 || updatedAppointments > 0,
      newUsers,
      updatedAppointments,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error fetching real-time updates:', error);
    res.status(500).json({ error: 'Failed to fetch real-time updates' });
  }
};

module.exports = {
  getDashboardStats,
  getDataHash,
  getRealTimeUpdates
}; 