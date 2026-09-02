"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markNotificationRead = exports.getNotifications = void 0;
const notificationService_1 = require("../../services/notificationService");
const appError_1 = require("../../utils/appError");
const getNotifications = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const notifications = await (0, notificationService_1.getNotificationsByUser)(req.user.id);
        res.status(200).json({
            status: 'success',
            data: { notifications },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getNotifications = getNotifications;
const markNotificationRead = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const { id } = req.params;
        const notification = await (0, notificationService_1.markAsRead)(id, req.user.id);
        if (!notification) {
            return next(new appError_1.AppError('Notification not found.', 404));
        }
        res.status(200).json({
            status: 'success',
            data: { notification },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.markNotificationRead = markNotificationRead;
