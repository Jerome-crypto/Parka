"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkOutDriver = exports.checkInDriver = exports.validateQR = void 0;
const zod_1 = require("zod");
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const crypto_1 = __importDefault(require("crypto"));
const qrService_1 = require("../../services/qrService");
const notificationService_1 = require("../../services/notificationService");
const socketService_1 = require("../../services/socketService");
const validateQRSchema = zod_1.z.object({
    token: zod_1.z.string(),
});
const checkinSchema = zod_1.z.object({
    reservationId: zod_1.z.string().uuid(),
});
const checkoutSchema = zod_1.z.object({
    sessionId: zod_1.z.string().uuid(),
});
const validateQR = async (req, res, next) => {
    try {
        const validated = validateQRSchema.parse(req.body);
        // 1. Verify QR token signature
        let qrData;
        try {
            qrData = (0, qrService_1.verifyQRToken)(validated.token);
        }
        catch {
            return next(new appError_1.AppError('Invalid or expired QR code.', 400));
        }
        // 2. Fetch reservation details
        const result = await (0, database_1.query)(`SELECT r.id, r.code, r.status, r.arrival_time, r.duration_hours, r.amount,
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
       WHERE r.code = $1`, [qrData.reservationId]);
        if (result.rows.length === 0) {
            return next(new appError_1.AppError('Reservation not found.', 404));
        }
        const reservation = result.rows[0];
        // Ensure reservation is still valid for check-in
        if (reservation.status !== 'upcoming') {
            return next(new appError_1.AppError(`This reservation has status '${reservation.status}' and cannot be validated.`, 400));
        }
        res.status(200).json({
            status: 'success',
            data: { reservation },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.validateQR = validateQR;
const checkInDriver = async (req, res, next) => {
    const client = await database_1.pool.connect();
    try {
        const validated = checkinSchema.parse(req.body);
        await client.query('BEGIN');
        // 1. Fetch reservation
        const resQuery = await client.query(`SELECT r.*, f.name as "facilityName" 
       FROM reservations r 
       JOIN parking_facilities f ON r.facility_id = f.id 
       WHERE r.id = $1 
       FOR UPDATE`, [validated.reservationId]);
        if (resQuery.rows.length === 0) {
            await client.query('ROLLBACK');
            return next(new appError_1.AppError('Reservation not found.', 404));
        }
        const reservation = resQuery.rows[0];
        if (reservation.status !== 'upcoming') {
            await client.query('ROLLBACK');
            return next(new appError_1.AppError(`Cannot check in driver. Reservation status is '${reservation.status}'`, 400));
        }
        // 2. Transition reservation status to active
        await client.query("UPDATE reservations SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [validated.reservationId]);
        // 3. Mark space as occupied
        if (reservation.space_id) {
            await client.query("UPDATE parking_spaces SET status = 'occupied' WHERE id = $1", [reservation.space_id]);
        }
        // Fetch vehicle plate for session record
        const vehicleRes = await client.query('SELECT plate FROM vehicles WHERE id = $1', [reservation.vehicle_id]);
        const plate = vehicleRes.rows[0].plate;
        // 4. Create Active Parking Session
        const sessionRes = await client.query(`INSERT INTO parking_sessions (
        reservation_id, facility_id, vehicle_plate, space_id, checkin_time, status
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'active')
       RETURNING *`, [reservation.id, reservation.facility_id, plate, reservation.space_id]);
        const session = sessionRes.rows[0];
        // Log status update
        await client.query(`INSERT INTO reservation_statuses (reservation_id, status, notes)
       VALUES ($1, 'active', 'Checked in, parking session started.')`, [reservation.id]);
        await client.query('COMMIT');
        // Send notifications and socket triggers
        await (0, notificationService_1.createNotification)({
            userId: reservation.driver_id,
            type: 'checkin',
            title: 'Checked In',
            body: `You checked in to ${reservation.facilityName}. Live parking timer started.`,
        });
        (0, socketService_1.emitCheckIn)(reservation.facility_id, session);
        res.status(200).json({
            status: 'success',
            data: { session },
        });
    }
    catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
    finally {
        client.release();
    }
};
exports.checkInDriver = checkInDriver;
const checkOutDriver = async (req, res, next) => {
    const client = await database_1.pool.connect();
    try {
        const validated = checkoutSchema.parse(req.body);
        await client.query('BEGIN');
        // 1. Lock and fetch session
        const sessionRes = await client.query(`SELECT s.*, f.price_per_hour, f.name as "facilityName"
       FROM parking_sessions s
       JOIN parking_facilities f ON s.facility_id = f.id
       WHERE s.id = $1 AND s.status = 'active'
       FOR UPDATE`, [validated.sessionId]);
        if (sessionRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return next(new appError_1.AppError('Active parking session not found.', 404));
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
            await client.query("UPDATE parking_spaces SET status = 'available' WHERE id = $1", [session.space_id]);
        }
        const facilityRes = await client.query('SELECT available_spaces FROM parking_facilities WHERE id = $1 FOR UPDATE', [session.facility_id]);
        const newAvailableSpaces = facilityRes.rows[0].available_spaces + 1;
        await client.query('UPDATE parking_facilities SET available_spaces = $1 WHERE id = $2', [newAvailableSpaces, session.facility_id]);
        // 3. Complete session
        const updatedSessionRes = await client.query(`UPDATE parking_sessions 
       SET checkout_time = $1, duration_minutes = $2, amount_charged = $3, status = 'completed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`, [checkoutTime, durationMinutes, amountCharged, validated.sessionId]);
        const updatedSession = updatedSessionRes.rows[0];
        // 4. Update reservation if attached or find driver by plate
        let driverId = null;
        if (session.reservation_id) {
            await client.query("UPDATE reservations SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [session.reservation_id]);
            const reservationRes = await client.query('SELECT driver_id FROM reservations WHERE id = $1', [session.reservation_id]);
            if (reservationRes.rows.length > 0) {
                driverId = reservationRes.rows[0].driver_id;
            }
            await client.query(`INSERT INTO reservation_statuses (reservation_id, status, notes)
         VALUES ($1, 'completed', 'Checked out, parking session complete.')`, [session.reservation_id]);
        }
        else {
            // Find driver by plate for drive-ins
            const vehicleRes = await client.query('SELECT driver_id FROM vehicles WHERE plate = $1 AND is_deleted = false', [session.vehicle_plate]);
            if (vehicleRes.rows.length > 0) {
                driverId = vehicleRes.rows[0].driver_id;
            }
        }
        // 5. Automatically create a completed payment & receipt
        if (driverId) {
            let provider = 'cash';
            const pmRes = await client.query('SELECT provider FROM user_payment_methods WHERE user_id = $1 AND is_default = true LIMIT 1', [driverId]);
            if (pmRes.rows.length > 0) {
                provider = pmRes.rows[0].provider;
            }
            const transactionReference = `${provider.toUpperCase() === 'CASH' ? 'CSH' : provider.toUpperCase() === 'MTN' ? 'MTN' : 'ATL'}-${crypto_1.default.randomBytes(8).toString('hex').toUpperCase()}`;
            const paymentRes = await client.query(`INSERT INTO payments (session_id, reservation_id, user_id, provider, status, transaction_reference, amount)
         VALUES ($1, $2, $3, $4, 'completed', $5, $6)
         RETURNING id`, [validated.sessionId, session.reservation_id || null, driverId, provider, transactionReference, amountCharged]);
            const paymentId = paymentRes.rows[0].id;
            const receiptNo = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto_1.default.randomBytes(3).toString('hex').toUpperCase()}`;
            await client.query(`INSERT INTO receipts (payment_id, receipt_number, details)
         VALUES ($1, $2, $3)`, [
                paymentId,
                receiptNo,
                JSON.stringify({
                    amount: amountCharged,
                    method: provider.toUpperCase(),
                    reference: transactionReference,
                    date: new Date(),
                }),
            ]);
        }
        await client.query('COMMIT');
        // Push notification to driver if available
        if (driverId) {
            const hoursLabel = durationHours === 1 ? '1 hour' : `${durationHours} hours`;
            await (0, notificationService_1.createNotification)({
                userId: driverId,
                type: 'checkout',
                title: 'Checked Out Successfully',
                body: `You checked out of ${session.facilityName}. Duration: ${hoursLabel}. Charged: UGX ${amountCharged.toLocaleString()}.`,
            });
        }
        (0, socketService_1.emitCheckOut)(session.facility_id, updatedSession);
        (0, socketService_1.emitFacilityUpdate)(session.facility_id, newAvailableSpaces);
        res.status(200).json({
            status: 'success',
            data: { session: updatedSession },
        });
    }
    catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
    finally {
        client.release();
    }
};
exports.checkOutDriver = checkOutDriver;
