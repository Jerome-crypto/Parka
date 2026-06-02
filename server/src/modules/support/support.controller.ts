import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../../config/database';
import { AppError } from '../../utils/appError';
import { createNotification } from '../../services/notificationService';

const ticketSchema = z.object({
  subject: z.string().min(3).max(120),
  message: z.string().min(5).max(3000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  sessionId: z.string().uuid().optional(),
  reservationId: z.string().uuid().optional(),
});

const statusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
});

export const createTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    const validated = ticketSchema.parse(req.body);

    const result = await query(
      `INSERT INTO support_tickets (user_id, session_id, reservation_id, subject, message, priority)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.user.id,
        validated.sessionId || null,
        validated.reservationId || null,
        validated.subject,
        validated.message,
        validated.priority,
      ]
    );

    await createNotification({
      userId: req.user.id,
      type: 'system',
      title: 'Support Request Received',
      body: `We received your support request: ${validated.subject}.`,
    });

    res.status(201).json({
      status: 'success',
      data: { ticket: result.rows[0] },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors[0].message, 400));
    }
    next(err);
  }
};

export const getTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));

    const params: unknown[] = [];
    let whereClause = '';
    if (req.user.role !== 'ADMIN') {
      params.push(req.user.id);
      whereClause = 'WHERE t.user_id = $1';
    }

    const result = await query(
      `SELECT t.*, u.name as "userName", u.email as "userEmail"
       FROM support_tickets t
       LEFT JOIN users u ON u.id = t.user_id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT 100`,
      params
    );

    res.status(200).json({
      status: 'success',
      data: { tickets: result.rows },
    });
  } catch (err) {
    next(err);
  }
};

export const updateTicketStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    if (req.user.role !== 'ADMIN') {
      return next(new AppError('Only admins can update support ticket status.', 403));
    }

    const validated = statusSchema.parse(req.body);
    const result = await query(
      `UPDATE support_tickets
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [validated.status, req.params.id]
    );

    if (result.rows.length === 0) {
      return next(new AppError('Support ticket not found.', 404));
    }

    const ticket = result.rows[0];
    if (ticket.user_id) {
      await createNotification({
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
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors[0].message, 400));
    }
    next(err);
  }
};
