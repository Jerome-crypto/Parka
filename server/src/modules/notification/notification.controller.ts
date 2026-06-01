import { Request, Response, NextFunction } from 'express';
import { getNotificationsByUser, markAsRead } from '../../services/notificationService';
import { AppError } from '../../utils/appError';

export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));

    const notifications = await getNotificationsByUser(req.user.id);

    res.status(200).json({
      status: 'success',
      data: { notifications },
    });
  } catch (err) {
    next(err);
  }
};

export const markNotificationRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    const { id } = req.params;

    const notification = await markAsRead(id, req.user.id);
    if (!notification) {
      return next(new AppError('Notification not found.', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { notification },
    });
  } catch (err) {
    next(err);
  }
};
