"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTicketStatus = exports.getTickets = exports.createTicket = void 0;
const zod_1 = require("zod");
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const notificationService_1 = require("../../services/notificationService");
const ticketSchema = zod_1.z.object({
    subject: zod_1.z.string().min(3).max(120),
    message: zod_1.z.string().min(5).max(3000),
    priority: zod_1.z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    sessionId: zod_1.z.string().uuid().optional(),
    reservationId: zod_1.z.string().uuid().optional(),
});
const statusSchema = zod_1.z.object({
    status: zod_1.z.enum(['open', 'in_progress', 'resolved', 'closed']),
});
const createTicket = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const validated = ticketSchema.parse(req.body);
        const result = await (0, database_1.query)(`INSERT INTO support_tickets (user_id, session_id, reservation_id, subject, message, priority)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`, [
            req.user.id,
            validated.sessionId || null,
            validated.reservationId || null,
            validated.subject,
            validated.message,
            validated.priority,
        ]);
        await (0, notificationService_1.createNotification)({
            userId: req.user.id,
            type: 'system',
            title: 'Support Request Received',
            body: `We received your support request: ${validated.subject}.`,
        });
        res.status(201).json({
            status: 'success',
            data: { ticket: result.rows[0] },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.createTicket = createTicket;
const getTickets = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const params = [];
        let whereClause = '';
        if (req.user.role !== 'ADMIN') {
            params.push(req.user.id);
            whereClause = 'WHERE t.user_id = $1';
        }
        const result = await (0, database_1.query)(`SELECT t.*, u.name as "userName", u.email as "userEmail"
       FROM support_tickets t
       LEFT JOIN users u ON u.id = t.user_id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT 100`, params);
        res.status(200).json({
            status: 'success',
            data: { tickets: result.rows },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getTickets = getTickets;
const updateTicketStatus = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        if (req.user.role !== 'ADMIN') {
            return next(new appError_1.AppError('Only admins can update support ticket status.', 403));
        }
        const validated = statusSchema.parse(req.body);
        const result = await (0, database_1.query)(`UPDATE support_tickets
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`, [validated.status, req.params.id]);
        if (result.rows.length === 0) {
            return next(new appError_1.AppError('Support ticket not found.', 404));
        }
        const ticket = result.rows[0];
        if (ticket.user_id) {
            await (0, notificationService_1.createNotification)({
                userId: ticket.user_id,
                type: 'system',
                title: 'Support Ticket Updated',
                body: `Your support ticket "${ticket.subject}" is now ${ticket.status.replace('_', ' ')}.`,
            });
        }
        res.status(200).json({
            status: 'success',
            data: { ticket },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.updateTicketStatus = updateTicketStatus;
