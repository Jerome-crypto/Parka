"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const migrate_1 = require("./database/migrate");
const seed_1 = require("./database/seed");
const errorHandler_1 = require("./middleware/errorHandler");
const socketService_1 = require("./services/socketService");
const logger_1 = require("./utils/logger");
// Import routers
const auth_router_1 = __importDefault(require("./modules/auth/auth.router"));
const vehicle_router_1 = __importDefault(require("./modules/vehicle/vehicle.router"));
const facility_router_1 = __importDefault(require("./modules/facility/facility.router"));
const reservation_router_1 = __importDefault(require("./modules/reservation/reservation.router"));
const scanner_router_1 = __importDefault(require("./modules/scanner/scanner.router"));
const session_router_1 = __importDefault(require("./modules/session/session.router"));
const payment_router_1 = __importDefault(require("./modules/payment/payment.router"));
const receipt_router_1 = __importDefault(require("./modules/receipt/receipt.router"));
const notification_router_1 = __importDefault(require("./modules/notification/notification.router"));
const operator_router_1 = __importDefault(require("./modules/operator/operator.router"));
const admin_router_1 = __importDefault(require("./modules/admin/admin.router"));
const profile_router_1 = __importDefault(require("./modules/profile/profile.router"));
const support_router_1 = __importDefault(require("./modules/support/support.router"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Initialize WebSockets
(0, socketService_1.initSocket)(server);
// ─── RAW CORS MIDDLEWARE ─────────────────────────────────────────────────────
// Must come FIRST before helmet and other middleware.
// Unconditionally sets Access-Control-Allow-Origin for every request from an
// allowed origin so the browser never sees a missing CORS header.
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const isAllowed = !origin ||
        origin.endsWith('.onrender.com') ||
        origin.startsWith('http://localhost') ||
        origin === 'https://parka-eqpq.onrender.com';
    if (isAllowed && origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
    }
    // End OPTIONS (preflight) requests immediately
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    next();
});
app.use((0, helmet_1.default)({
    // Disable CORP so cross-origin API responses are not blocked by the browser
    crossOriginResourcePolicy: false,
}));
const allowedOrigins = [
    env_1.env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:5000',
    'https://parka-eqpq.onrender.com',
];
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin)
            return callback(null, true);
        const isAllowed = allowedOrigins.includes(origin) ||
            origin.endsWith('.onrender.com') ||
            origin.startsWith('http://localhost');
        if (isAllowed) {
            callback(null, true);
        }
        else {
            callback(new Error(`CORS: Origin '${origin}' is not allowed`));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200,
};
// Also register the cors package as a belt-and-suspenders fallback
app.options('*', (0, cors_1.default)(corsOptions));
app.use((0, cors_1.default)(corsOptions));
// Body parsing
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// HTTP Request logging
app.use((0, morgan_1.default)('combined', {
    stream: { write: (message) => logger_1.logger.http(message.trim()) }
}));
// Rate Limiting
const limiter = (0, express_rate_limit_1.default)({
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
app.use('/api/auth', auth_router_1.default);
app.use('/api/vehicles', vehicle_router_1.default);
app.use('/api/facilities', facility_router_1.default);
app.use('/api/reservations', reservation_router_1.default);
app.use('/api/scanner', scanner_router_1.default);
app.use('/api/sessions', session_router_1.default);
app.use('/api/payments', payment_router_1.default);
app.use('/api/receipts', receipt_router_1.default);
app.use('/api/notifications', notification_router_1.default);
app.use('/api/operator', operator_router_1.default);
app.use('/api/admin', admin_router_1.default);
app.use('/api/profile', profile_router_1.default);
app.use('/api/support', support_router_1.default);
// Global Error Handler
app.use(errorHandler_1.errorHandler);
const startServer = async () => {
    try {
        // Self-healing: Run migrations on boot to ensure PostgreSQL state matches schema
        await (0, migrate_1.runMigrations)();
        // Safe seeding on first boot
        await (0, seed_1.seedDatabase)(false);
        server.listen(env_1.env.PORT, () => {
            logger_1.logger.info(`🚀 Parka server successfully started on port ${env_1.env.PORT} in ${env_1.env.NODE_ENV} mode.`);
            // ── KEEPALIVE: prevent Render free-tier from spinning down ────────────
            // Render free tier sleeps after 15 min of inactivity.
            // Pinging /health every 4 min keeps the process alive.
            // Only runs in production so local dev is unaffected.
            if (env_1.env.NODE_ENV === 'production') {
                const https = require('https');
                const SELF_URL = `https://parka-server.onrender.com/health`;
                setInterval(() => {
                    https.get(SELF_URL, (res) => {
                        logger_1.logger.info(`[keepalive] /health → ${res.statusCode}`);
                    }).on('error', (err) => {
                        logger_1.logger.warn(`[keepalive] ping failed: ${err.message}`);
                    });
                }, 4 * 60 * 1000); // every 4 minutes
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
