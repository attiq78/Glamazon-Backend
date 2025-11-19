const User = require('../models/User');
const Otp = require('../models/Otp');
const jwt = require('jsonwebtoken');
const Appointment = require('../models/Appointment');
const { sendOtpEmail, sendPasswordChangeEmail, sendPasswordResetEmail } = require('../utils/sendEmail');
const { addOnlineUser, isUserOnline, updateUserActivity } = require('../utils/onlineUsers');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.initiateSignup = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate and save OTP
    const otp = generateOTP();
    await Otp.findOneAndDelete({ email }); // Delete any existing OTP
    await new Otp({ email, otp }).save();

    try {
      // Send OTP email
      await sendOtpEmail(email, otp);
      res.status(200).json({ message: 'OTP sent successfully' });
    } catch (emailError) {
      // If email fails, delete the OTP and return error
      await Otp.findOneAndDelete({ email });
      console.error('Detailed email error:', emailError);
      
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        return res.status(500).json({ 
          error: 'Email service not configured. Please check EMAIL_SETUP.md for configuration instructions.' 
        });
      }
      
      if (emailError.code === 'EAUTH') {
        return res.status(500).json({ 
          error: 'Email authentication failed. Please check your Gmail App Password configuration.' 
        });
      }
      
      if (emailError.code === 'ECONNECTION') {
        return res.status(500).json({ 
          error: 'Email connection failed. Please check your internet connection.' 
        });
      }
      
      return res.status(500).json({ 
        error: `Email sending failed: ${emailError.message}. Please check your email configuration.` 
      });
    }
  } catch (error) {
    console.error('Signup initiation error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.verifyOtpAndSignup = async (req, res) => {
  try {
    const { type, email, name, phone, password, otp } = req.body;

    // Verify OTP
    const otpRecord = await Otp.findOne({ email });
    if (!otpRecord) {
      return res.status(400).json({ error: 'OTP expired or not found' });
    }

    if (otpRecord.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
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
    await Otp.deleteOne({ email }); // Delete the used OTP
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

    // Use comparePassword method from User model to validate password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login time
    user.lastLogin = new Date();
    await user.save();

    // Add user to online list
    addOnlineUser(user._id.toString(), {
      name: user.name,
      email: user.email,
      type: user.type
    });

    const token = generateToken(user._id);

    res.json({
      user: {
        id: user._id,
        type: user.type,
        email: user.email,
        name: user.name,
        phone: user.phone,
        isDefaultAdmin: user.isDefaultAdmin || false
      },
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Other controller functions unchanged...

// Create new user (admin only)
exports.createUser = async (req, res) => {
  try {
    // Check if user is admin
    const admin = await User.findById(req.user.id);
    if (!admin || admin.type !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { name, email, phone, password, type = 'client' } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create new user — password will be hashed by User model pre-save hook
    const user = new User({
      type,
      email,
      name,
      phone,
      password
    });

    await user.save();

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({ user: userResponse });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get dashboard statistics (admin only)
exports.getDashboardStats = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    // Get total users count
    const totalUsers = await User.countDocuments({ type: 'client' });

    // Get total appointments
    const totalAppointments = await Appointment.countDocuments();

    // Get today's appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAppointments = await Appointment.countDocuments({
      date: {
        $gte: today,
        $lt: tomorrow
      }
    });

    // Get upcoming appointments (future appointments)
    const upcomingAppointments = await Appointment.countDocuments({
      date: { $gt: today },
      status: { $nin: ['cancelled', 'completed'] }
    });

  // Get cancelled appointments count
    const cancelledAppointments = await Appointment.countDocuments({
      status: 'cancelled'
    });

    res.json({
      stats: {
        totalUsers,
        totalAppointments,
        todayAppointments,
        upcomingAppointments,
        cancelledAppointments
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      users: users.map(user => ({
        id: user._id,
        type: user.type,
        email: user.email,
        name: user.name,
        phone: user.phone,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin || null,
        isOnline: isUserOnline(user._id.toString()),
        isDefaultAdmin: user.isDefaultAdmin || false
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update user (admin only)
exports.updateUser = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { userId } = req.params;
    const { name, email, phone } = req.body;

    // Find user and update
    const user = await User.findByIdAndUpdate(
      userId,
      { name, email, phone },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const { userId } = req.params;
    
    // Validate userId is a valid MongoDB ObjectId
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    // Check if user exists and prevent deletion of default admin
    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only default admin can delete other admins
    if (userToDelete.type === 'admin' && !req.user.isDefaultAdmin) {
      return res.status(403).json({ error: 'Only the default admin can delete other admin users' });
    }

    // Prevent deletion of default admin
    if (userToDelete.isDefaultAdmin) {
      return res.status(403).json({ error: 'Cannot delete the default admin user' });
    }

    // Delete user
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Also delete all appointments associated with this user
    await Appointment.deleteMany({ user: userId });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get user statistics
exports.getUserStats = async (req, res) => {
  try {
    const totalAppointments = await Appointment.countDocuments({ user: req.user.id });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcomingAppointments = await Appointment.countDocuments({
      user: req.user.id,
      date: { $gte: today },
      status: { $nin: ['cancelled', 'completed'] }
    });

    const completedAppointments = await Appointment.countDocuments({
      user: req.user.id,
      status: 'completed'
    });

    const cancelledAppointments = await Appointment.countDocuments({
      user: req.user.id,
      status: 'cancelled'
    });

    res.json({
      stats: {
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
        cancelledAppointments
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new password are required' });
    }

    // Get user with password
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save(); // This will trigger the password hashing middleware

    // Send email notification
    try {
      await sendPasswordChangeEmail(user.email, user.name);
    } catch (emailError) {
      console.error('Failed to send password change email:', emailError);
      // Don't return error to client, as password was changed successfully
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Forgot password - send reset link
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address' });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Send reset email
    await sendPasswordResetEmail(user.email, user.name, resetToken);

    res.json({ message: 'Password reset link has been sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
};

// Reset password using token
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Send confirmation email
    try {
      await sendPasswordChangeEmail(user.email, user.name);
    } catch (emailError) {
      console.error('Failed to send password change confirmation email:', emailError);
    }

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired reset token' });
    }
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

// Heartbeat endpoint to keep user online
exports.heartbeat = async (req, res) => {
  try {
    const userId = req.user.id;
    updateUserActivity(userId);
    res.json({ message: 'Heartbeat received' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get detailed user status (default admin only)
exports.getUserStatus = async (req, res) => {
  try {
    // Check if user is default admin
    if (!req.user.isDefaultAdmin) {
      return res.status(403).json({ error: 'Access denied. Default admin only.' });
    }

    const { userId } = req.params;
    
    // Validate userId is a valid MongoDB ObjectId
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's appointments
    const appointments = await Appointment.find({ user: userId })
      .sort({ date: -1 })
      .limit(10);

    // Get online status
    const isOnline = isUserOnline(userId);

    res.json({
      user: {
        id: user._id,
        type: user.type,
        email: user.email,
        name: user.name,
        phone: user.phone,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        isDefaultAdmin: user.isDefaultAdmin,
        isOnline
      },
      appointments: appointments.map(apt => ({
        id: apt._id,
        date: apt.date,
        time: apt.time,
        service: apt.service,
        status: apt.status
      })),
      stats: {
        totalAppointments: await Appointment.countDocuments({ user: userId }),
        completedAppointments: await Appointment.countDocuments({ user: userId, status: 'completed' }),
        cancelledAppointments: await Appointment.countDocuments({ user: userId, status: 'cancelled' }),
        upcomingAppointments: await Appointment.countDocuments({ 
          user: userId, 
          date: { $gte: new Date() },
          status: { $nin: ['cancelled', 'completed'] }
        })
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};