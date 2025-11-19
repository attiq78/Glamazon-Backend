# Email Configuration Setup for OTP Functionality

## Prerequisites
1. Gmail account with 2-Step Verification enabled
2. App Password generated for the application

## Step-by-Step Setup

### 1. Enable 2-Step Verification
1. Go to your Google Account settings
2. Navigate to Security
3. Enable 2-Step Verification if not already enabled

### 2. Generate App Password
1. Go to Google Account settings
2. Navigate to Security > 2-Step Verification
3. Scroll down to "App passwords"
4. Select "Mail" and "Other (Custom name)"
5. Enter "Glamazon Salon" as the name
6. Copy the generated 16-character password

### 3. Create .env File
Create a `.env` file in the `glamazon-backend` directory with:

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/glamazon

# JWT Configuration
JWT_SECRET=your_very_long_random_secret_key_here

# Email Configuration
EMAIL_USER=your_gmail_address@gmail.com
EMAIL_PASSWORD=your_16_character_app_password

# Server Configuration
PORT=5001
NODE_ENV=development
```

### 4. Test Email Configuration
After setting up the .env file, restart the backend server and test the OTP functionality.

## Troubleshooting

### Common Issues:
1. **EAUTH Error**: Check if App Password is correct
2. **Connection Timeout**: Check internet connection
3. **Invalid Credentials**: Ensure 2-Step Verification is enabled

### Debug Steps:
1. Check server logs for SMTP errors
2. Verify .env file is in the correct location
3. Ensure all environment variables are set
4. Test with a simple email first 