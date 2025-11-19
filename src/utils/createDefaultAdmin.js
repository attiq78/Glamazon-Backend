const User = require('../models/User');

const createDefaultAdmin = async () => {
  try {
    // Check if admin already exists
    const adminExists = await User.findOne({ email: 'attiq1367@gmail.com' });
    
    if (!adminExists) {
      const admin = new User({
        type: 'admin',
        email: 'attiq1367@gmail.com',
        name: 'attique',
        phone: '03007081317',
        password: 'test11221122',
        isDefaultAdmin: true
      });

      await admin.save();
      console.log('Default admin user created successfully');
    } else {
      console.log('Default admin user already exists');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
};

module.exports = createDefaultAdmin; 