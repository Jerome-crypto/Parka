"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelReservation = exports.getReservationById = exports.getReservations = exports.createReservation = void 0;
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const qrService_1 = require("../../services/qrService");
const notificationService_1 = require("../../services/notificationService");
const socketService_1 = require("../../services/socketService");
const reservationCreateSchema = zod_1.z.object({
    facilityId: zod_1.z.string().uuid(),
    vehicleId: zod_1.z.string().uuid(),
    arrivalTime: zod_1.z.string(), // ISO string or parsable date
    durationHours: zod_1.z.coerce.number().int().positive().max(24),
});
const createReservation = async (req, res, next) => {
    if (!req.user)
        return next(new appError_1.AppError('Unauthorized', 401));
    const client = await database_1.pool.connect();
    try {
        const validated = reservationCreateSchema.parse(req.body);
        const arrivalDate = new Date(validated.arrivalTime);
        if (arrivalDate < new Date()) {
            return next(new appError_1.AppError('Arrival time must be in the future.', 400));
        }
        // Begin transaction
        await client.query('BEGIN');
        // 1. Lock facility row and get price/capacity
        const facilityRes = await client.query(`SELECT id, name, available_spaces, price_per_hour 
       FROM parking_facilities 
       WHERE id = $1 
       FOR UPDATE`, [validated.facilityId]);
        if (facilityRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return next(new appError_1.AppError('Parking facility not found.', 404));
        }
        const facility = facilityRes.rows[0];
        if (facility.available_spaces <= 0) {
            await client.query('ROLLBACK');
            return next(new appError_1.AppError('No spaces currently available in this facility.', 400));
        }
        // 2. Double-check and lock an available space row
        const spaceRes = await client.query(`SELECT s.id, s.space_number, z.name as zone_name
       FROM parking_spaces s
       JOIN parking_zones z ON s.zone_id = z.id
       WHERE z.facility_id = $1 AND s.status = 'available'
       LIMIT 1
       FOR UPDATE`, [validated.facilityId]);
        if (spaceRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return next(new appError_1.AppError('No spaces currently available in the system.', 400));
        }
        const space = spaceRes.rows[0];
        // 3. Check if driver has this vehicle
        const vehicleRes = await client.query('SELECT id, plate FROM vehicles WHERE id = $1 AND driver_id = $2 AND is_deleted = false', [validated.vehicleId, req.user.id]);
        if (vehicleRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return next(new appError_1.AppError('Vehicle not found or not registered to you.', 404));
        }
        const vehicle = vehicleRes.rows[0];
        // 4. Reserve space and update counter
        const newAvailableSpaces = facility.available_spaces - 1;
        await client.query('UPDATE parking_facilities SET available_spaces = $1 WHERE id = $2', [newAvailableSpaces, validated.facilityId]);
        await client.query("UPDATE parking_spaces SET status = 'reserved' WHERE id = $1", [space.id]);
        // 5. Calculate cost & codes
        const amount = facility.price_per_hour * validated.durationHours;
        const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randSerial = crypto_1.default.randomBytes(2).toString('hex').toUpperCase();
        const code = `RES-${datePrefix}-${randSerial}`;
        // Generate token string to encode inside QR code
        const qrCodeToken = (0, qrService_1.generateQRToken)({
            reservationId: code,
            facilityId: validated.facilityId,
            driverId: req.user.id,
            arrivalTime: validated.arrivalTime,
        });
        // 6. Insert Reservation row
        const reservationRes = await client.query(`INSERT INTO reservations (
        code, driver_id, facility_id, vehicle_id, space_id, 
        arrival_time, duration_hours, amount, status, qr_code_token
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'upcoming', $9)
       RETURNING *`, [
            code,
            req.user.id,
            validated.facilityId,
            validated.vehicleId,
            space.id,
            arrivalDate,
            validated.durationHours,
            amount,
            qrCodeToken,
        ]);
        const reservation = reservationRes.rows[0];
        // Log status trace
        await client.query(`INSERT INTO reservation_statuses (reservation_id, status, notes)
       VALUES ($1, 'upcoming', 'Booking created.')`, [reservation.id]);
        await client.query('COMMIT');
        // 7. Push Notification & Broadcast updates
        await (0, notificationService_1.createNotification)({
            userId: req.user.id,
            type: 'confirm',
            title: 'Reservation Confirmed',
            body: `Your parking at ${facility.name} (Zone ${space.zone_name} · Space ${space.space_number}) is confirmed code: ${code}.`,
        });
        (0, socketService_1.emitFacilityUpdate)(validated.facilityId, newAvailableSpaces);
        res.status(201).json({
            status: 'success',
            data: {
                reservation: {
                    ...reservation,
                    facilityName: facility.name,
                    vehiclePlate: vehicle.plate,
                    zone: space.zone_name,
                    spaceNumber: space.space_number,
                },
            },
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
exports.createReservation = createReservation;
const getReservations = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        let queryStr = `
      SELECT r.*, f.name as "facilityName", v.plate as "vehiclePlate", s.space_number as "spaceNumber", z.name as "zone", u.name as "driverName"
      FROM reservations r
      JOIN parking_facilities f ON r.facility_id = f.id
      JOIN vehicles v ON r.vehicle_id = v.id
      JOIN users u ON r.driver_id = u.id
      LEFT JOIN parking_spaces s ON r.space_id = s.id
      LEFT JOIN parking_zones z ON s.zone_id = z.id
    `;
        const queryParams = [];
        // Filter by role: drivers see their own; attendants, operators and admins see facility filters if provided
        if (req.user.role === 'DRIVER') {
            queryStr += ' WHERE r.driver_id = $1';
            queryParams.push(req.user.id);
        }
        else if (req.user.role === 'ATTENDANT') {
            // Find which facility the attendant belongs to
            const profileRes = await (0, database_1.query)('SELECT facility_id FROM attendant_profiles WHERE user_id = $1', [req.user.id]);
            if (profileRes.rows.length > 0 && profileRes.rows[0].facility_id) {
                queryStr += ' WHERE r.facility_id = $1';
                queryParams.push(profileRes.rows[0].facility_id);
            }
        }
        else if (req.user.role === 'OPERATOR') {
            // Operators see their own facilities
            queryStr += ' WHERE f.operator_id = $1';
            queryParams.push(req.user.id);
        }
        queryStr += ' ORDER BY r.created_at DESC';
        const result = await (0, database_1.query)(queryStr, queryParams);
        res.status(200).json({
            status: 'success',
            data: { reservations: result.rows },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getReservations = getReservations;
const getReservationById = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const { id } = req.params;
        const result = await (0, database_1.query)(`SELECT r.*, f.name as "facilityName", v.plate as "vehiclePlate", s.space_number as "spaceNumber", z.name as "zone"
       FROM reservations r
       JOIN parking_facilities f ON r.facility_id = f.id
       JOIN vehicles v ON r.vehicle_id = v.id
       LEFT JOIN parking_spaces s ON r.space_id = s.id
       LEFT JOIN parking_zones z ON s.zone_id = z.id
       WHERE r.id = $1`, [id]);
        if (result.rows.length === 0) {
            return next(new appError_1.AppError('Reservation not found.', 404));
        }
        const reservation = result.rows[0];
        // Access control check
        if (req.user.role === 'DRIVER' && reservation.driver_id !== req.user.id) {
            return next(new appError_1.AppError('Unauthorized access to this reservation.', 403));
        }
        res.status(200).json({
            status: 'success',
            data: { reservation },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getReservationById = getReservationById;
const cancelReservation = async (req, res, next) => {
    if (!req.user)
        return next(new appError_1.AppError('Unauthorized', 401));
    const { id } = req.params;
    const client = await database_1.pool.connect();
    try {
        await client.query('BEGIN');
        // 1. Get reservation and lock
        const resResult = await client.query('SELECT id, driver_id, facility_id, space_id, status FROM reservations WHERE id = $1 FOR UPDATE', [id]);
        if (resResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return next(new appError_1.AppError('Reservation not found.', 404));
        }
        const reservation = resResult.rows[0];
        // Access control
        if (req.user.role === 'DRIVER' && reservation.driver_id !== req.user.id) {
            await client.query('ROLLBACK');
            return next(new appError_1.AppError('Unauthorized to cancel this reservation.', 403));
        }
        if (reservation.status !== 'upcoming') {
            await client.query('ROLLBACK');
            return next(new appError_1.AppError(`Cannot cancel a reservation in '${reservation.status}' status.`, 400));
        }
        // 2. Set status to cancelled
        await client.query("UPDATE reservations SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
        // 3. Release space
        if (reservation.space_id) {
            await client.query("UPDATE parking_spaces SET status = 'available' WHERE id = $1", [reservation.space_id]);
        }
        // 4. Increment availability count
        const facilityRes = await client.query('SELECT available_spaces FROM parking_facilities WHERE id = $1 FOR UPDATE', [reservation.facility_id]);
        const newAvailableSpaces = facilityRes.rows[0].available_spaces + 1;
        await client.query('UPDATE parking_facilities SET available_spaces = $1 WHERE id = $2', [newAvailableSpaces, reservation.facility_id]);
        // Save status change logs
        await client.query(`INSERT INTO reservation_statuses (reservation_id, status, notes)
       VALUES ($1, 'cancelled', 'Cancelled by user.')`, [id]);
        await client.query('COMMIT');
        // Send notifications and updates
        await (0, notificationService_1.createNotification)({
            userId: reservation.driver_id,
            type: 'facility',
            title: 'Reservation Cancelled',
            body: 'Your reservation was cancelled and space released.',
        });
        (0, socketService_1.emitFacilityUpdate)(reservation.facility_id, newAvailableSpaces);
        res.status(200).json({
            status: 'success',
            message: 'Reservation cancelled successfully.',
        });
    }
    catch (err) {
        await client.query('ROLLBACK');
        next(err);
    }
    finally {
        client.release();
    }
};
exports.cancelReservation = cancelReservation;
