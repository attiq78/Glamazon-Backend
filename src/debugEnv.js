const path = require('path');
const dotenv = require('dotenv');

console.log('Current working directory:', process.cwd());
console.log('Looking for .env file in:', path.resolve(process.cwd(), '.env'));

const result = dotenv.config();
if (result.error) {
  console.log('Error loading .env file:', result.error.message);
} else {
  console.log('.env file loaded successfully');
}

console.log('\nEnvironment Variables:');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASSWORD exists:', !!process.env.EMAIL_PASSWORD);
console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI:', process.env.MONGODB_URI); 