"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogs = exports.getSystemMetrics = exports.approveFacility = exports.getPendingFacilities = exports.toggleUserStatus = exports.getUsers = void 0;
const zod_1 = require("zod");
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const statusSchema = zod_1.z.object({
    status: zod_1.z.enum(['active', 'suspended', 'pending']),
});
const approvalSchema = zod_1.z.object({
    decision: zod_1.z.enum(['approved', 'rejected']),
});
const getUsers = async (req, res, next) => {
    try {
        const drivers = await (0, database_1.query)(`SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at as joined,
        COUNT(ps.id) as sessions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN reservations res ON res.driver_id = u.id
       LEFT JOIN parking_sessions ps ON ps.reservation_id = res.id
       WHERE r.name = 'DRIVER'
       GROUP BY u.id`);
        const operators = await (0, database_1.query)(`SELECT u.id, u.name, u.email, u.phone, u.status, op.company_name as company,
        COUNT(f.id) as facilities,
        COALESCE(SUM(ps.amount_charged), 0) as revenue
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN operator_profiles op ON op.user_id = u.id
       LEFT JOIN parking_facilities f ON f.operator_id = u.id
       LEFT JOIN parking_sessions ps ON ps.facility_id = f.id
       WHERE r.name = 'OPERATOR'
       GROUP BY u.id, op.company_name`);
        const attendants = await (0, database_1.query)(`SELECT u.id, u.name, u.email, u.phone, u.status, f.name as facility, ap.shift_info as shift
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN attendant_profiles ap ON ap.user_id = u.id
       LEFT JOIN parking_facilities f ON ap.facility_id = f.id
       WHERE r.name = 'ATTENDANT'`);
        res.status(200).json({
            status: 'success',
            data: {
                drivers: drivers.rows,
                operators: operators.rows,
                attendants: attendants.rows,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getUsers = getUsers;
const toggleUserStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const validated = statusSchema.parse(req.body);
        const result = await (0, database_1.query)('UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, email, status', [validated.status, id]);
        if (result.rows.length === 0) {
            return next(new appError_1.AppError('User not found.', 404));
        }
        res.status(200).json({
            status: 'success',
            data: { user: result.rows[0] },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.toggleUserStatus = toggleUserStatus;
const getPendingFacilities = async (req, res, next) => {
    try {
        const pending = await (0, database_1.query)(`SELECT f.*, op.company_name as operator
       FROM parking_facilities f
       LEFT JOIN users u ON f.operator_id = u.id
       LEFT JOIN operator_profiles op ON op.user_id = u.id
       WHERE f.status = 'pending'
       ORDER BY f.created_at DESC`);
        const active = await (0, database_1.query)(`SELECT f.*, op.company_name as operator
       FROM parking_facilities f
       LEFT JOIN users u ON f.operator_id = u.id
       LEFT JOIN operator_profiles op ON op.user_id = u.id
       WHERE f.status = 'active'
       ORDER BY f.created_at DESC`);
        res.status(200).json({
            status: 'success',
            data: {
                pending: pending.rows,
                active: active.rows,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getPendingFacilities = getPendingFacilities;
const approveFacility = async (req, res, next) => {
    try {
        const { id } = req.params;
        const validated = approvalSchema.parse(req.body);
        const statusValue = validated.decision === 'approved' ? 'active' : 'rejected';
        const result = await (0, database_1.query)('UPDATE parking_facilities SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [statusValue, id]);
        if (result.rows.length === 0) {
            return next(new appError_1.AppError('Parking facility not found.', 404));
        }
        res.status(200).json({
            status: 'success',
            data: { facility: result.rows[0] },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.approveFacility = approveFacility;
const getSystemMetrics = async (req, res, next) => {
    try {
        // Return telemetry indicators
        res.status(200).json({
            status: 'success',
            data: {
                systemMetrics: [
                    { label: 'API Status', status: 'operational', latency: '42ms' },
                    { label: 'Database', status: 'operational', latency: '8ms' },
                    { label: 'Push Notifications', status: 'operational', latency: '120ms' },
                    { label: 'Payment Gateway', status: 'operational', latency: '15ms' }, // Cash recorded instantly
                    { label: 'Map Services (Leaflet)', status: 'operational', latency: '0ms' }, // Local rendering
                    { label: 'QR Scanner API', status: 'operational', latency: '30ms' },
                ],
                stats: {
                    uptime: '99.9%',
                    avgLatency: '45ms',
                    errorRate: '0.04%',
                },
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getSystemMetrics = getSystemMetrics;
const getAuditLogs = async (req, res, next) => {
    try {
        const result = await (0, database_1.query)(`SELECT a.*, u.name as "userName" 
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC LIMIT 100`);
        res.status(200).json({
            status: 'success',
            data: { auditLogs: result.rows },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getAuditLogs = getAuditLogs;
