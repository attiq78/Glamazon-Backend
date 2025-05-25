const User = require('../models/User');
const jwt = require('jsonwebtoken');
const Appointment = require('../models/Appointment');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

exports.signup = async (req, res) => {
  try {
    const { type, email, name, phone, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create new user
    const user = new User({
      type,
      email,
      name,
      phone,
      password
    });

    await user.save();
    const token = generateToken(user._id);

    res.status(201).json({
      user: {
        id: user._id,
        type: user.type,
        email: user.email,
        name: user.name,
        phone: user.phone
      },
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      user: {
        id: user._id,
        type: user.type,
        email: user.email,
        name: user.name,
        phone: user.phone
      },
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.id);
    console.log(user);
    if (!user || user.type !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    // Get total users (excluding admins)
    const totalUsers = await User.countDocuments({ type: 'client' });

    // Get total appointments
    const totalAppointments = await Appointment.countDocuments();

    // Get upcoming appointments awaiting confirmation
    const upcomingAppointments = await Appointment.countDocuments({
      date: { $gte: new Date() },
      status: 'approved'
    });

    // Get today's appointments
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todayAppointments = await Appointment.countDocuments({
      date: {
        $gte: startOfToday,
        $lte: endOfToday
      }
    });

    res.json({
      stats: {
        totalUsers,
        totalAppointments,
        upcomingAppointments,
        todayAppointments
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}; 