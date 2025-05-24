import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import twilio from 'twilio';
import { twilioAccountSid, twilioAuthToken, twilioPhoneNumber, jwtSecret } from '../config/config';
import { authenticate } from './sso';

const ModuleName = '[server]';

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// --- Data Models ---
interface User {
  id: string;
  otp: string;
  verified: boolean;
}

interface TimeSlot {
  id: number;
  userId: string;
  startTime: string;
  endTime: string;
  availability: 'public' | 'private';
}

// --- In-Memory Storage (for MVP/demo) ---
const users: Record<string, User> = {};
const timeSlots: TimeSlot[] = [];

const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

// --- Helpers ---
const generateOTP = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// --- Routes ---

// 1) Register: send OTP
app.post('/register', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { phoneNumber } = req.body as { phoneNumber?: string };
    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    const otp = generateOTP();
    users[phoneNumber] = { id: phoneNumber, otp, verified: false };

    await twilioClient.messages.create({
      body: `Your verification code is ${otp}`,
      from: twilioPhoneNumber,
      to: phoneNumber,
    });
    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// 2) Verify: check OTP and issue JWT
app.post('/verify', (req: Request, res: Response, next: NextFunction): void => {
  const { phoneNumber, otp } = req.body as {
    phoneNumber?: string;
    otp?: string;
  };
  if (!phoneNumber || !otp) {
    res.status(400).json({ error: 'Phone number and OTP are required' });
    return;
  }

  const user = users[phoneNumber];
  if (!user) {
    res.status(400).json({ error: 'User not found' });
    return;
  }

  if (user.otp === otp) {
    user.verified = true;
    const token = jwt.sign({ id: user.id, phoneNumber }, jwtSecret, {
      expiresIn: '1h',
    });
    res.json({ message: 'Verification successful', token });
  } else {
    res.status(400).json({ error: 'Invalid OTP' });
  }
});

// 4) Create a time slot
app.post('/slot', authenticate, (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { startTime, endTime, availability } = req.body as {
    startTime?: string;
    endTime?: string;
    availability?: 'public' | 'private';
  };

  if (!startTime || !endTime || !availability) {
    res.status(400).json({ error: 'startTime, endTime, and availability are required' });
    return;
  }

  const newSlot: TimeSlot = {
    id: timeSlots.length + 1,
    userId: req.user!.id,
    startTime,
    endTime,
    availability,
  };

  timeSlots.push(newSlot);
  res.json({ message: 'Time slot created successfully', slot: newSlot });
});

// 5) List all slots for the authenticated user
app.get('/slots', authenticate, (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const userSlots = timeSlots.filter((slot) => slot.userId === req.user!.id);
  res.json({ slots: userSlots });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
