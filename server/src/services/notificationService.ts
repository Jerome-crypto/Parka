import { query } from '../config/database';
import { emitNotification } from './socketService';
import { logger } from '../utils/logger';

interface CreateNotificationParams {
  userId: string;
  type: 'confirm' | 'reminder' | 'checkin' | 'checkout' | 'payment' | 'facility' | 'system';
  title: string;
  body: string;
}

export const createNotification = async (params: CreateNotificationParams) => {
  try {
    const result = await query(
      `INSERT INTO notifications (user_id, type, title, body, is_read)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id, type, title, body, is_read, created_at`,
      [params.userId, params.type, params.title, params.body]
    );

    const notification = result.rows[0];

    // Emit live via socket
    emitNotification(params.userId, notification);

    return notification;
  } catch (error) {
    logger.error('Error in createNotification service:', error);
    throw error;
  }
};

export const getNotificationsByUser = async (userId: string) => {
  const result = await query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [userId]
  );
  return result.rows;
};

export const markAsRead = async (notificationId: string, userId: string) => {
  const result = await query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
    [notificationId, userId]
  );
  return result.rows[0];
};
