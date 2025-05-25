const Appointment = require('../models/Appointment');

// Helper function to generate time slots
const generateTimeSlots = (startTime, endTime, interval) => {
  const slots = [];
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  let currentTime = new Date();
  currentTime.setHours(startHour, startMinute, 0);
  
  const endDateTime = new Date();
  endDateTime.setHours(endHour, endMinute, 0);
  
  while (currentTime < endDateTime) {
    slots.push(currentTime.toTimeString().slice(0, 5));
    currentTime.setMinutes(currentTime.getMinutes() + interval);
  }
  
  return slots;
};

// Helper function to check if a slot is available
const isSlotAvailable = (slot, duration, bookedSlots) => {
  const [slotHour, slotMinute] = slot.split(':').map(Number);
  const slotStart = new Date();
  slotStart.setHours(slotHour, slotMinute, 0);
  
  const slotEnd = new Date(slotStart);
  slotEnd.setMinutes(slotEnd.getMinutes() + duration);
  
  for (const bookedSlot of bookedSlots) {
    const [bookedHour, bookedMinute] = bookedSlot.time.split(':').map(Number);
    const bookedStart = new Date();
    bookedStart.setHours(bookedHour, bookedMinute, 0);
    
    const bookedEnd = new Date(bookedStart);
    bookedEnd.setMinutes(bookedEnd.getMinutes() + bookedSlot.service.duration);
    
    // Check for overlap
    if (
      (slotStart >= bookedStart && slotStart < bookedEnd) ||
      (slotEnd > bookedStart && slotEnd <= bookedEnd) ||
      (slotStart <= bookedStart && slotEnd >= bookedEnd)
    ) {
      return false;
    }
  }
  
  return true;
};

exports.getAvailableSlots = async (req, res) => {
  try {
    const { date, serviceDuration } = req.query;
    
    if (!date || !serviceDuration) {
      return res.status(400).json({ error: 'Date and service duration are required' });
    }

    // Convert date string to Date object
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // Get all booked appointments for the selected date
    const bookedAppointments = await Appointment.find({
      date: {
        $gte: selectedDate,
        $lt: nextDate
      },
      status: { $ne: 'cancelled' }
    });

    // Generate all possible time slots (30-minute intervals)
    const allSlots = generateTimeSlots('11:00', '22:00', 30);
    
    // Filter available slots
    const availableSlots = allSlots.filter(slot => 
      isSlotAvailable(slot, parseInt(serviceDuration), bookedAppointments)
    );

    res.json({
      date: date,
      serviceDuration: parseInt(serviceDuration),
      availableSlots
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.bookAppointment = async (req, res) => {
  try {
    const { date, time, service } = req.body;
    const userId = req.user._id;

    const appointment = new Appointment({
      user: userId,
      date,
      time,
      service
    });

    await appointment.save();

    res.status(201).json({
      appointment: {
        id: appointment._id,
        date: appointment.date,
        time: appointment.time,
        service: appointment.service,
        status: appointment.status
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const userId = req.user._id;
    const appointments = await Appointment.find({ user: userId })
      .sort({ date: 1, time: 1 });

    res.json({
      appointments: appointments.map(appointment => ({
        id: appointment._id,
        date: appointment.date,
        time: appointment.time,
        service: appointment.service,
        status: appointment.status
      }))
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAdminAppointments = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    // Get query parameters for filtering
    const { status, date, page = 1, limit = 10 } = req.query;
    
    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (date) {
      const selectedDate = new Date(date);
      selectedDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(selectedDate);
      nextDate.setDate(nextDate.getDate() + 1);
      filter.date = {
        $gte: selectedDate,
        $lt: nextDate
      };
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Get appointments with pagination and populate user details
    const appointments = await Appointment.find(filter)
      .populate('user') // Assuming user model has these fields
      .sort({ date: 1, time: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Appointment.countDocuments(filter);

    res.json({
      appointments: appointments.map(appointment => ({
        id: appointment._id,
        date: appointment.date,
        time: appointment.time,
        service: appointment.service,
        status: appointment.status,
        user: appointment.user,
        createdAt: appointment.createdAt
      })),
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}; 