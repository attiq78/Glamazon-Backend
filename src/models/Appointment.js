const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  service: {
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    duration: {
      type: Number,  // Duration in minutes
      required: true
    }
  },
  hairstyle: {
    name: {
      type: String,
      default: ''
    },
    image: {
      type: String,
      default: ''
    }
  },
  status: {
    type: String,
    enum: ['approved', 'completed', 'cancelled'],
    default: 'approved'
  }
}, {
  timestamps: true
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment; 