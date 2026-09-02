"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitCheckOut = exports.emitCheckIn = exports.emitNotification = exports.emitFacilityUpdate = exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
const logger_1 = require("../utils/logger");
const env_1 = require("../config/env");
let io = null;
const initSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: env_1.env.CLIENT_URL,
            methods: ['GET', 'POST'],
        },
    });
    io.on('connection', (socket) => {
        logger_1.logger.info(`🔌 Socket connected: ${socket.id}`);
        // Join room for user notifications
        socket.on('join_user', (userId) => {
            socket.join(`user:${userId}`);
            logger_1.logger.debug(`Socket ${socket.id} joined user room user:${userId}`);
        });
        // Join room for facility updates
        socket.on('join_facility', (facilityId) => {
            socket.join(`facility:${facilityId}`);
            logger_1.logger.debug(`Socket ${socket.id} joined facility room facility:${facilityId}`);
        });
        // Join admin group
        socket.on('join_admin', () => {
            socket.join('admin');
            logger_1.logger.debug(`Socket ${socket.id} joined admin room`);
        });
        socket.on('disconnect', () => {
            logger_1.logger.info(`🔌 Socket disconnected: ${socket.id}`);
        });
    });
    return io;
};
exports.initSocket = initSocket;
const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO is not initialized!');
    }
    return io;
};
exports.getIO = getIO;
// Real-time Event Broadcasters
const emitFacilityUpdate = (facilityId, availableSpaces) => {
    if (!io)
        return;
    io.to(`facility:${facilityId}`).emit('facility_availability_updated', {
        facilityId,
        availableSpaces,
    });
    // Also broadcast to general updates for explores
    io.emit('facility_availability_updated', {
        facilityId,
        availableSpaces,
    });
};
exports.emitFacilityUpdate = emitFacilityUpdate;
const emitNotification = (userId, notification) => {
    if (!io)
        return;
    io.to(`user:${userId}`).emit('notification_created', notification);
};
exports.emitNotification = emitNotification;
const emitCheckIn = (facilityId, session) => {
    if (!io)
        return;
    io.to(`facility:${facilityId}`).emit('driver_checked_in', session);
};
exports.emitCheckIn = emitCheckIn;
const emitCheckOut = (facilityId, session) => {
    if (!io)
        return;
    io.to(`facility:${facilityId}`).emit('driver_checked_out', session);
};
exports.emitCheckOut = emitCheckOut;
