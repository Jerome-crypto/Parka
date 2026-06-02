import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

import { env } from './config/env';
import { runMigrations } from './database/migrate';
import { seedDatabase } from './database/seed';
import { errorHandler } from './middleware/errorHandler';
import { initSocket } from './services/socketService';
import { logger } from './utils/logger';

// Import routers
import authRouter from './modules/auth/auth.router';
import vehicleRouter from './modules/vehicle/vehicle.router';
import facilityRouter from './modules/facility/facility.router';
import reservationRouter from './modules/reservation/reservation.router';
import scannerRouter from './modules/scanner/scanner.router';
import sessionRouter from './modules/session/session.router';
import paymentRouter from './modules/payment/payment.router';
import receiptRouter from './modules/receipt/receipt.router';
import notificationRouter from './modules/notification/notification.router';
import operatorRouter from './modules/operator/operator.router';
import adminRouter from './modules/admin/admin.router';
import profileRouter from './modules/profile/profile.router';
import supportRouter from './modules/support/support.router';

const app = express();
const server = http.createServer(app);

// Initialize WebSockets
initSocket(server);

app.use(helmet());
const allowedOrigins = [env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:5000'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.includes(origin) || origin.endsWith('.onrender.com');
    callback(null, isAllowed ? true : origin);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP Request logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.http(message.trim()) }
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api', limiter);

// Root/Health route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'Parka API is healthy' });
});

// Versioned API Routes
app.use('/api/auth', authRouter);
app.use('/api/vehicles', vehicleRouter);
app.use('/api/facilities', facilityRouter);
app.use('/api/reservations', reservationRouter);
app.use('/api/scanner', scannerRouter);
app.use('/api/sessions', sessionRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/receipts', receiptRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/operator', operatorRouter);
app.use('/api/admin', adminRouter);
app.use('/api/profile', profileRouter);
app.use('/api/support', supportRouter);

// Global Error Handler
app.use(errorHandler);

const startServer = async () => {
  try {
    // Self-healing: Run migrations on boot to ensure PostgreSQL state matches schema
    await runMigrations();

    // Safe seeding on first boot
    await seedDatabase(false);

    server.listen(env.PORT, () => {
      logger.info(`🚀 Parka server successfully started on port ${env.PORT} in ${env.NODE_ENV} mode.`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
