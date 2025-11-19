const Appointment = require('../models/Appointment');
const { sendEmail } = require('../utils/sendEmail');

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
const isSlotAvailable = (slot, duration, bookedSlots, selectedDate) => {
  const [slotHour, slotMinute] = slot.split(':').map(Number);
  
  // Create slot start time using the selected date
  const slotStart = new Date(selectedDate);
  slotStart.setHours(slotHour, slotMinute, 0, 0);
  
  const slotEnd = new Date(slotStart);
  slotEnd.setMinutes(slotEnd.getMinutes() + duration);
  
  for (const bookedSlot of bookedSlots) {
    const [bookedHour, bookedMinute] = bookedSlot.time.split(':').map(Number);
    
    // Create booked start time using the selected date
    const bookedStart = new Date(selectedDate);
    bookedStart.setHours(bookedHour, bookedMinute, 0, 0);
    
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

    // Check if selected date is before today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      return res.status(400).json({ error: 'Cannot book appointments for past dates' });
    }

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
    
    // Get current time if booking for today
    const now = new Date();
    const isToday = selectedDate.getTime() === today.getTime();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Filter available slots
    const availableSlots = allSlots.filter(slot => {
      // For today's bookings, filter out past time slots
      if (isToday) {
        const [slotHour, slotMinute] = slot.split(':').map(Number);
        // Add 30 minutes buffer for immediate bookings
        const bookingTime = new Date();
        bookingTime.setHours(currentHour, currentMinute + 30);
        
        const slotTime = new Date(selectedDate);
        slotTime.setHours(slotHour, slotMinute);
        
        if (slotTime < bookingTime) {
          return false;
        }
      }
      
      return isSlotAvailable(slot, parseInt(serviceDuration), bookedAppointments, selectedDate);
    });

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
    const { date, time, service, hairstyle } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!date || !time || !service) {
      return res.status(400).json({ error: 'Date, time and service are required' });
    }

    // Validate service data
    if (!service.name || !service.price || !service.duration) {
      return res.status(400).json({ error: 'Invalid service data' });
    }

    // Validate date format
    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Validate time format (HH:mm)
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return res.status(400).json({ error: 'Invalid time format' });
    }

    // Check if slot is available
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointment = await Appointment.findOne({
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      time: time,
      status: { $ne: 'cancelled' }
    });

    if (existingAppointment) {
      return res.status(400).json({ error: 'This time slot is no longer available' });
    }

    // Create appointment
    const appointment = new Appointment({
      user: userId,
      date,
      time,
      service,
      hairstyle,
      status: 'approved'
    });

    await appointment.save();

    // Populate user details for the email
    await appointment.populate('user');

    // Format date for email
    const formattedDate = new Date(date).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Send booking confirmation email
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #6c63ff; text-align: center;">Glamazon Salon</h2>
          <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-top: 20px;">
            <h3 style="color: #333; margin-bottom: 20px;">Booking Confirmation</h3>
            
            ${hairstyle?.name ? `
              <div style="margin-bottom: 20px;">
                <h4 style="color: #333; margin-bottom: 10px;">Selected Hairstyle</h4>
                <p style="margin: 5px 0; color: #666;">Style Name: <span style="color: #333; font-weight: bold;">${hairstyle.name}</span></p>
                <p style="margin: 5px 0; color: #666; font-style: italic;">You can view your selected hairstyle in your appointment details on the website.</p>
              </div>
            ` : ''}
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Service:</td>
                <td style="padding: 8px 0; font-weight: bold;">${service.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Date:</td>
                <td style="padding: 8px 0; font-weight: bold;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Time:</td>
                <td style="padding: 8px 0; font-weight: bold;">${time}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Price:</td>
                <td style="padding: 8px 0; font-weight: bold;">Rs. ${service.price}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Duration:</td>
                <td style="padding: 8px 0; font-weight: bold;">${service.duration} minutes</td>
              </tr>
            </table>

            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
              <h4 style="color: #333; margin-bottom: 10px;">Customer Information</h4>
              <p style="margin: 5px 0; color: #666;">Name: <span style="color: #333; font-weight: bold;">${appointment.user.name}</span></p>
              <p style="margin: 5px 0; color: #666;">Email: <span style="color: #333; font-weight: bold;">${appointment.user.email}</span></p>
              ${appointment.user.phone ? `<p style="margin: 5px 0; color: #666;">Phone: <span style="color: #333; font-weight: bold;">${appointment.user.phone}</span></p>` : ''}
            </div>

            <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 4px;">
              <p style="margin: 0; color: #666; font-size: 14px;">Please arrive 5-10 minutes before your appointment time.</p>
              <p style="margin: 5px 0 0; color: #666; font-size: 14px;">For any queries, please contact us at support@glamazon.com</p>
            </div>
          </div>
        </div>
      `;

      await sendEmail(
        appointment.user.email,
        'Booking Confirmation - Glamazon Salon',
        emailHtml
      );

      res.status(201).json({
        appointment: {
          id: appointment._id,
          date: appointment.date,
          time: appointment.time,
          service: appointment.service,
          hairstyle: appointment.hairstyle,
          status: appointment.status
        },
        message: 'Appointment booked successfully. A confirmation email has been sent to your email address.'
      });
    } catch (emailError) {
      console.error('Failed to send booking confirmation email:', emailError);
      // Still return success as booking was successful
      res.status(201).json({
        appointment: {
          id: appointment._id,
          date: appointment.date,
          time: appointment.time,
          service: appointment.service,
          hairstyle: appointment.hairstyle,
          status: appointment.status
        },
        message: 'Appointment booked successfully, but failed to send confirmation email.'
      });
    }
  } catch (error) {
    console.error('Booking error:', error);
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
        hairstyle: appointment.hairstyle,
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
      .populate('user')
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
        hairstyle: appointment.hairstyle,
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

exports.cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user._id;

    // Find the appointment
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check if the user owns this appointment or is an admin
    if (appointment.user.toString() !== userId.toString() && req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to cancel this appointment' });
    }

    // Update the appointment status to cancelled
    appointment.status = 'cancelled';
    await appointment.save();

    // Populate user details for response
    await appointment.populate('user');

    res.json({
      appointment: {
        id: appointment._id,
        date: appointment.date,
        time: appointment.time,
        service: appointment.service,
        status: appointment.status,
        user: appointment.user
      },
      message: 'Appointment cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.deleteAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user._id;

    // Find the appointment
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Only admin can delete appointments
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete appointments' });
    }

    // Delete the appointment
    await Appointment.findByIdAndDelete(appointmentId);

    res.json({
      message: 'Appointment deleted successfully'
    });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(400).json({ error: error.message });
  }
}; 