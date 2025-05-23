import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import twilio from "twilio";

const ModuleName = "[server]";

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
  availability: "public" | "private";
}

interface JwtPayload {
  id: string;
  phoneNumber: string;
}

// --- In-Memory Storage (for MVP/demo) ---
const users: Record<string, User> = {};
const timeSlots: TimeSlot[] = [];

// --- Twilio Setup ---
const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER ?? "";
const twilioClient = twilio(accountSid, authToken);

// --- JWT Secret ---
const JWT_SECRET = process.env.JWT_SECRET ?? "your_jwt_secret";

// --- Helpers ---
const generateOTP = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// --- Routes ---

// 1) Register: send OTP
app.post("/register", async (req: Request, res: Response) => {
  const { phoneNumber } = req.body as { phoneNumber?: string };
  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  const otp = generateOTP();
  users[phoneNumber] = { id: phoneNumber, otp, verified: false };

  try {
    await twilioClient.messages.create({
      body: `Your verification code is ${otp}`,
      from: twilioPhoneNumber,
      to: phoneNumber,
    });
    return res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
});

// 2) Verify: check OTP and issue JWT
app.post("/verify", (req: Request, res: Response) => {
  const { phoneNumber, otp } = req.body as {
    phoneNumber?: string;
    otp?: string;
  };
  if (!phoneNumber || !otp) {
    return res.status(400).json({ error: "Phone number and OTP are required" });
  }

  const user = users[phoneNumber];
  if (!user) {
    return res.status(400).json({ error: "User not found" });
  }

  if (user.otp === otp) {
    user.verified = true;
    const token = jwt.sign({ id: user.id, phoneNumber }, JWT_SECRET, {
      expiresIn: "1h",
    });
    return res.json({ message: "Verification successful", token });
  } else {
    return res.status(400).json({ error: "Invalid OTP" });
  }
});

// 3) Auth middleware
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// 4) Create a time slot
app.post("/slot", authenticate, (req: Request, res: Response) => {
  const { startTime, endTime, availability } = req.body as {
    startTime?: string;
    endTime?: string;
    availability?: "public" | "private";
  };

  if (!startTime || !endTime || !availability) {
    return res
      .status(400)
      .json({ error: "startTime, endTime, and availability are required" });
  }

  const newSlot: TimeSlot = {
    id: timeSlots.length + 1,
    userId: req.user!.id,
    startTime,
    endTime,
    availability,
  };

  timeSlots.push(newSlot);
  return res.json({ message: "Time slot created successfully", slot: newSlot });
});

// 5) List all slots for the authenticated user
app.get("/slots", authenticate, (req: Request, res: Response) => {
  const userSlots = timeSlots.filter((slot) => slot.userId === req.user!.id);
  return res.json({ slots: userSlots });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
