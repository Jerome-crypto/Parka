"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVehicle = exports.updateVehicle = exports.getVehicles = exports.createVehicle = void 0;
const zod_1 = require("zod");
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const vehicleSchema = zod_1.z.object({
    plate: zod_1.z.string().min(3).max(15).toUpperCase(),
    make: zod_1.z.string().min(2),
    model: zod_1.z.string().min(1),
    color: zod_1.z.string().min(2),
    year: zod_1.z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1),
    type: zod_1.z.enum(['sedan', 'suv', 'truck', 'motorcycle']),
});
const createVehicle = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const validated = vehicleSchema.parse(req.body);
        // Check if plate already registered and not deleted
        const vehicleExists = await (0, database_1.query)('SELECT id, is_deleted FROM vehicles WHERE plate = $1', [validated.plate]);
        if (vehicleExists.rows.length > 0) {
            if (!vehicleExists.rows[0].is_deleted) {
                return next(new appError_1.AppError('A vehicle with this plate is already registered.', 400));
            }
            else {
                // Reactivate deleted vehicle
                const reactivated = await (0, database_1.query)(`UPDATE vehicles 
           SET driver_id = $1, make = $2, model = $3, color = $4, year = $5, type = $6, is_deleted = false, updated_at = CURRENT_TIMESTAMP
           WHERE id = $7
           RETURNING id, plate, make, model, color, year, type`, [
                    req.user.id,
                    validated.make,
                    validated.model,
                    validated.color,
                    validated.year,
                    validated.type,
                    vehicleExists.rows[0].id,
                ]);
                res.status(200).json({
                    status: 'success',
                    data: { vehicle: reactivated.rows[0] },
                });
                return;
            }
        }
        const newVehicle = await (0, database_1.query)(`INSERT INTO vehicles (driver_id, plate, make, model, color, year, type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, plate, make, model, color, year, type`, [
            req.user.id,
            validated.plate,
            validated.make,
            validated.model,
            validated.color,
            validated.year,
            validated.type,
        ]);
        res.status(201).json({
            status: 'success',
            data: { vehicle: newVehicle.rows[0] },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.createVehicle = createVehicle;
const getVehicles = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const vehicles = await (0, database_1.query)('SELECT id, plate, make, model, color, year, type FROM vehicles WHERE driver_id = $1 AND is_deleted = false ORDER BY created_at DESC', [req.user.id]);
        res.status(200).json({
            status: 'success',
            data: { vehicles: vehicles.rows },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getVehicles = getVehicles;
const updateVehicle = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const validated = vehicleSchema.parse(req.body);
        const { id } = req.params;
        // Check ownership
        const vehicle = await (0, database_1.query)('SELECT id FROM vehicles WHERE id = $1 AND driver_id = $2 AND is_deleted = false', [id, req.user.id]);
        if (vehicle.rows.length === 0) {
            return next(new appError_1.AppError('Vehicle not found or unauthorized.', 404));
        }
        const updated = await (0, database_1.query)(`UPDATE vehicles 
       SET plate = $1, make = $2, model = $3, color = $4, year = $5, type = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING id, plate, make, model, color, year, type`, [
            validated.plate,
            validated.make,
            validated.model,
            validated.color,
            validated.year,
            validated.type,
            id,
        ]);
        res.status(200).json({
            status: 'success',
            data: { vehicle: updated.rows[0] },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.updateVehicle = updateVehicle;
const deleteVehicle = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const { id } = req.params;
        // Check ownership
        const vehicle = await (0, database_1.query)('SELECT id FROM vehicles WHERE id = $1 AND driver_id = $2 AND is_deleted = false', [id, req.user.id]);
        if (vehicle.rows.length === 0) {
            return next(new appError_1.AppError('Vehicle not found or unauthorized.', 404));
        }
        // Soft delete
        await (0, database_1.query)('UPDATE vehicles SET is_deleted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
        res.status(200).json({
            status: 'success',
            message: 'Vehicle deleted successfully.',
        });
    }
    catch (err) {
        next(err);
    }
};
exports.deleteVehicle = deleteVehicle;
