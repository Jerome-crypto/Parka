import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool, query } from '../../config/database';
import { AppError } from '../../utils/appError';
import { verifyQRToken } from '../../services/qrService';
import { createNotification } from '../../services/notificationService';
import { emitCheckIn, emitCheckOut, emitFacilityUpdate } from '../../services/socketService';

const validateQRSchema = z.object({
  token: z.string(),
});

const checkinSchema = z.object({
  reservationId: z.string().uuid(),
});

const checkoutSchema = z.object({
  sessionId: z.string().uuid(),
});

export const validateQR = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = validateQRSchema.parse(req.body);

    // 1. Verify QR token signature
    let qrData;
    try {
      qrData = verifyQRToken(validated.token);
    } catch {
      return next(new AppError('Invalid or expired QR code.', 400));
    }

    // 2. Fetch reservation details
    const result = await query(
      `SELECT r.id, r.code, r.status, r.arrival_time, r.duration_hours, r.amount,
              f.name as "facilityName", f.id as "facilityId",
              u.name as "driverName", u.id as "driverId",
              v.plate as "vehiclePlate",
              s.space_number as "spaceNumber", s.id as "spaceId",
              z.name as "zone"
       FROM reservations r
       JOIN users u ON r.driver_id = u.id
       JOIN parking_facilities f ON r.facility_id = f.id
       JOIN vehicles v ON r.vehicle_id = v.id
       LEFT JOIN parking_spaces s ON r.space_id = s.id
       LEFT JOIN parking_zones z ON s.zone_id = z.id
       WHERE r.code = $1`,
      [qrData.reservationId]
    );

    if (result.rows.length === 0) {
      return next(new AppError('Reservation not found.', 404));
    }

    const reservation = result.rows[0];

    // Ensure reservation is still valid for check-in
    if (reservation.status !== 'upcoming') {
      return next(new AppError(`This reservation has status '${reservation.status}' and cannot be validated.`, 400));
    }

    res.status(200).json({
      status: 'success',
      data: { reservation },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors[0].message, 400));
    }
    next(err);
  }
};

export const checkInDriver = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const validated = checkinSchema.parse(req.body);

    await client.query('BEGIN');

    // 1. Fetch reservation
    const resQuery = await client.query(
      `SELECT r.*, f.name as "facilityName" 
       FROM reservations r 
       JOIN parking_facilities f ON r.facility_id = f.id 
       WHERE r.id = $1 
       FOR UPDATE`,
      [validated.reservationId]
    );

    if (resQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return next(new AppError('Reservation not found.', 404));
    }

    const reservation = resQuery.rows[0];

    if (reservation.status !== 'upcoming') {
      await client.query('ROLLBACK');
      return next(new AppError(`Cannot check in driver. Reservation status is '${reservation.status}'`, 400));
    }

    // 2. Transition reservation status to active
    await client.query(
      "UPDATE reservations SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [validated.reservationId]
    );

    // 3. Mark space as occupied
    if (reservation.space_id) {
      await client.query(
        "UPDATE parking_spaces SET status = 'occupied' WHERE id = $1",
        [reservation.space_id]
      );
    }

    // Fetch vehicle plate for session record
    const vehicleRes = await client.query('SELECT plate FROM vehicles WHERE id = $1', [reservation.vehicle_id]);
    const plate = vehicleRes.rows[0].plate;

    // 4. Create Active Parking Session
    const sessionRes = await client.query(
      `INSERT INTO parking_sessions (
        reservation_id, facility_id, vehicle_plate, space_id, checkin_time, status
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'active')
       RETURNING *`,
      [reservation.id, reservation.facility_id, plate, reservation.space_id]
    );

    const session = sessionRes.rows[0];

    // Log status update
    await client.query(
      `INSERT INTO reservation_statuses (reservation_id, status, notes)
       VALUES ($1, 'active', 'Checked in, parking session started.')`,
      [reservation.id]
    );

    await client.query('COMMIT');

    // Send notifications and socket triggers
    await createNotification({
      userId: reservation.driver_id,
      type: 'checkin',
      title: 'Checked In',
      body: `You checked in to ${reservation.facilityName}. Live parking timer started.`,
    });

    emitCheckIn(reservation.facility_id, session);

    res.status(200).json({
      status: 'success',
      data: { session },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors[0].message, 400));
    }
    next(err);
  } finally {
    client.release();
  }
};

export const checkOutDriver = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const validated = checkoutSchema.parse(req.body);

    await client.query('BEGIN');

    // 1. Lock and fetch session
    const sessionRes = await client.query(
      `SELECT s.*, f.price_per_hour, f.name as "facilityName"
       FROM parking_sessions s
       JOIN parking_facilities f ON s.facility_id = f.id
       WHERE s.id = $1 AND s.status = 'active'
       FOR UPDATE`,
      [validated.sessionId]
    );

    if (sessionRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return next(new AppError('Active parking session not found.', 404));
    }

    const session = sessionRes.rows[0];
    const checkoutTime = new Date();
    const checkinTime = new Date(session.checkin_time);

    // Calculate duration in minutes (ensure minimum of 1 minute)
    const durationMs = checkoutTime.getTime() - checkinTime.getTime();
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
    const durationHours = Math.ceil(durationMinutes / 60.0);

    // Calculate rate
    const amountCharged = durationHours * session.price_per_hour;

    // 2. Set space to available and increment facility spaces counter
    if (session.space_id) {
      await client.query(
        "UPDATE parking_spaces SET status = 'available' WHERE id = $1",
        [session.space_id]
      );
    }

    const facilityRes = await client.query(
      'SELECT available_spaces FROM parking_facilities WHERE id = $1 FOR UPDATE',
      [session.facility_id]
    );
    const newAvailableSpaces = facilityRes.rows[0].available_spaces + 1;

    await client.query(
      'UPDATE parking_facilities SET available_spaces = $1 WHERE id = $2',
      [newAvailableSpaces, session.facility_id]
    );

    // 3. Complete session
    const updatedSessionRes = await client.query(
      `UPDATE parking_sessions 
       SET checkout_time = $1, duration_minutes = $2, amount_charged = $3, status = 'completed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [checkoutTime, durationMinutes, amountCharged, validated.sessionId]
    );
    const updatedSession = updatedSessionRes.rows[0];

    // 4. Update reservation if attached
    let driverId = null;
    if (session.reservation_id) {
      await client.query(
        "UPDATE reservations SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [session.reservation_id]
      );
      
      const reservationRes = await client.query('SELECT driver_id FROM reservations WHERE id = $1', [session.reservation_id]);
      if (reservationRes.rows.length > 0) {
        driverId = reservationRes.rows[0].driver_id;
      }

      await client.query(
        `INSERT INTO reservation_statuses (reservation_id, status, notes)
         VALUES ($1, 'completed', 'Checked out, parking session complete.')`,
        [session.reservation_id]
      );
    }

    await client.query('COMMIT');

    // Push notification to driver if available
    if (driverId) {
      const hoursLabel = durationHours === 1 ? '1 hour' : `${durationHours} hours`;
      await createNotification({
        userId: driverId,
        type: 'checkout',
        title: 'Checked Out Successfully',
        body: `You checked out of ${session.facilityName}. Duration: ${hoursLabel}. Charged: UGX ${amountCharged.toLocaleString()}.`,
      });
    }

    emitCheckOut(session.facility_id, updatedSession);
    emitFacilityUpdate(session.facility_id, newAvailableSpaces);

    res.status(200).json({
      status: 'success',
      data: { session: updatedSession },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors[0].message, 400));
    }
    next(err);
  } finally {
    client.release();
  }
};
