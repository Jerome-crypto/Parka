"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAsRead = exports.getNotificationsByUser = exports.createNotification = void 0;
const database_1 = require("../config/database");
const socketService_1 = require("./socketService");
const logger_1 = require("../utils/logger");
const createNotification = async (params) => {
    try {
        const result = await (0, database_1.query)(`INSERT INTO notifications (user_id, type, title, body, is_read)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id, type, title, body, is_read, created_at`, [params.userId, params.type, params.title, params.body]);
        const notification = result.rows[0];
        // Emit live via socket
        (0, socketService_1.emitNotification)(params.userId, notification);
        return notification;
    }
    catch (error) {
        logger_1.logger.error('Error in createNotification service:', error);
        throw error;
    }
};
exports.createNotification = createNotification;
const getNotificationsByUser = async (userId) => {
    const result = await (0, database_1.query)('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId]);
    return result.rows;
};
exports.getNotificationsByUser = getNotificationsByUser;
const markAsRead = async (notificationId, userId) => {
    const result = await (0, database_1.query)('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *', [notificationId, userId]);
    return result.rows[0];
};
exports.markAsRead = markAsRead;
