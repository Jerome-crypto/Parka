import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { logger } from '../utils/logger';
import { env } from '../config/env';

let io: SocketServer | null = null;

export const initSocket = (server: HttpServer) => {
  io = new SocketServer(server, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 Socket connected: ${socket.id}`);

    // Join room for user notifications
    socket.on('join_user', (userId: string) => {
      socket.join(`user:${userId}`);
      logger.debug(`Socket ${socket.id} joined user room user:${userId}`);
    });

    // Join room for facility updates
    socket.on('join_facility', (facilityId: string) => {
      socket.join(`facility:${facilityId}`);
      logger.debug(`Socket ${socket.id} joined facility room facility:${facilityId}`);
    });

    // Join admin group
    socket.on('join_admin', () => {
      socket.join('admin');
      logger.debug(`Socket ${socket.id} joined admin room`);
    });

    socket.on('disconnect', () => {
      logger.info(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketServer => {
  if (!io) {
    throw new Error('Socket.IO is not initialized!');
  }
  return io;
};

// Real-time Event Broadcasters
export const emitFacilityUpdate = (facilityId: string, availableSpaces: number) => {
  if (!io) return;
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

export const emitNotification = (userId: string, notification: unknown) => {
  if (!io) return;
  io.to(`user:${userId}`).emit('notification_created', notification);
};

export const emitCheckIn = (facilityId: string, session: unknown) => {
  if (!io) return;
  io.to(`facility:${facilityId}`).emit('driver_checked_in', session);
};

export const emitCheckOut = (facilityId: string, session: unknown) => {
  if (!io) return;
  io.to(`facility:${facilityId}`).emit('driver_checked_out', session);
};
