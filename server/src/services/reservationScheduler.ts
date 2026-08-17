import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { createNotification } from './notificationService';
import { emitFacilityUpdate } from './socketService';

/**
 * Sweeps the database for reservations that are in 'upcoming' status
 * but whose arrival_time + 30 minutes has already passed.
 * Auto-cancels them, releases the space, updates available_spaces, and notifies the driver.
 */
export const cancelExpiredReservations = async (): Promise<number> => {
  const client = await pool.connect();
  let cancelledCount = 0;

  try {
    await client.query('BEGIN');

    // Find all upcoming reservations where arrival_time + 30 minutes < NOW()
    const overdueRes = await client.query(
      `SELECT r.id, r.code, r.driver_id, r.facility_id, r.space_id, f.name as facility_name
       FROM reservations r
       JOIN parking_facilities f ON r.facility_id = f.id
       WHERE r.status = 'upcoming'
         AND (r.arrival_time + INTERVAL '30 minutes') < CURRENT_TIMESTAMP
       FOR UPDATE OF r`
    );

    if (overdueRes.rows.length === 0) {
      await client.query('COMMIT');
      return 0;
    }

    for (const res of overdueRes.rows) {
      // 1. Mark reservation as cancelled/expired
      await client.query(
        `UPDATE reservations 
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [res.id]
      );

      // 2. Release parking space
      if (res.space_id) {
        await client.query(
          "UPDATE parking_spaces SET status = 'available' WHERE id = $1",
          [res.space_id]
        );
      }

      // 3. Increment facility available spaces
      const facilityRes = await client.query(
        'SELECT available_spaces FROM parking_facilities WHERE id = $1 FOR UPDATE',
        [res.facility_id]
      );

      const newAvailable = (facilityRes.rows[0]?.available_spaces || 0) + 1;

      await client.query(
        'UPDATE parking_facilities SET available_spaces = $1 WHERE id = $2',
        [newAvailable, res.facility_id]
      );

      // 4. Log status trail
      await client.query(
        `INSERT INTO reservation_statuses (reservation_id, status, notes)
         VALUES ($1, 'cancelled', 'Auto-cancelled: 30-minute no-show grace period expired.')`,
        [res.id]
      );

      // 5. Send notification to driver
      await createNotification({
        userId: res.driver_id,
        type: 'facility',
        title: 'Reservation Cancelled (No-Show)',
        body: `Your reservation (${res.code}) at ${res.facility_name} was automatically cancelled because 30 minutes passed past your scheduled arrival time.`,
      });

      // 6. Broadcast socket update for real-time map/availability
      emitFacilityUpdate(res.facility_id, newAvailable);

      cancelledCount++;
    }

    await client.query('COMMIT');

    if (cancelledCount > 0) {
      logger.info(`[ReservationScheduler] Auto-cancelled ${cancelledCount} no-show reservation(s).`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[ReservationScheduler] Error while sweeping overdue reservations:', error);
  } finally {
    client.release();
  }

  return cancelledCount;
};

/**
 * Initializes a background timer to run every 60 seconds (1 minute).
 */
export const initReservationScheduler = (intervalMs = 60 * 1000) => {
  logger.info('🕒 Reservation 30-minute auto-cancellation scheduler initialized.');
  
  // Run an immediate sweep on boot
  cancelExpiredReservations().catch((err) => {
    logger.error('[ReservationScheduler] Initial sweep failed:', err);
  });

  // Schedule periodic sweeps
  const intervalId = setInterval(() => {
    cancelExpiredReservations().catch((err) => {
      logger.error('[ReservationScheduler] Interval sweep failed:', err);
    });
  }, intervalMs);

  return intervalId;
};
