import * as dotenv from 'dotenv';

const ModuleName = '[config]';

// --- Twilio Setup ---
export const twilioAccountSid = process.env['TWILIO_ACCOUNT_SID='] || '';
export const twilioAuthToken = process.env['TWILIO_AUTH_TOKEN'] || '';
export const twilioPhoneNumber = process.env['TWILIO_PHONE_NUMBER'] || '';

// --- JWT Secret ---
export const jwtSecret = process.env['JWT_SECRET'] || '';
