"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFacilityAvailability = exports.searchFacilities = exports.getNearbyFacilities = exports.deleteFacility = exports.updateFacility = exports.upsertFacilityReview = exports.getFacilityReviews = exports.getFacilityById = exports.getFacilities = exports.createFacility = void 0;
const zod_1 = require("zod");
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const facilityCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(3),
    address: zod_1.z.string().min(5),
    latitude: zod_1.z.coerce.number().min(-90).max(90),
    longitude: zod_1.z.coerce.number().min(-180).max(180),
    totalSpaces: zod_1.z.coerce.number().int().positive(),
    pricePerHour: zod_1.z.coerce.number().int().positive(),
    type: zod_1.z.enum(['covered', 'open', 'multi-story']),
    hours: zod_1.z.string().default('24/7'),
    hasSecurity: zod_1.z.boolean().default(true),
    imageUrl: zod_1.z.string().url().optional(),
    amenities: zod_1.z.array(zod_1.z.string()).default([]),
});
const reviewSchema = zod_1.z.object({
    rating: zod_1.z.coerce.number().min(1).max(5),
    comment: zod_1.z.string().max(1000).optional(),
});
const createFacility = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const validated = facilityCreateSchema.parse(req.body);
        const result = await (0, database_1.query)(`INSERT INTO parking_facilities (
        operator_id, name, address, latitude, longitude, total_spaces, 
        available_spaces, price_per_hour, type, hours, has_security, image_url, amenities, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11, $12, 'pending')
       RETURNING *`, [
            req.user.id,
            validated.name,
            validated.address,
            validated.latitude,
            validated.longitude,
            validated.totalSpaces,
            validated.pricePerHour,
            validated.type,
            validated.hours,
            validated.hasSecurity,
            validated.imageUrl || null,
            validated.amenities,
        ]);
        const newFacility = result.rows[0];
        // Seed default Zone & spaces for this new facility
        const zoneRes = await (0, database_1.query)("INSERT INTO parking_zones (facility_id, name) VALUES ($1, 'Zone A') RETURNING id", [newFacility.id]);
        const zoneId = zoneRes.rows[0].id;
        for (let i = 1; i <= Math.min(validated.totalSpaces, 20); i++) {
            await (0, database_1.query)("INSERT INTO parking_spaces (zone_id, space_number, status, type) VALUES ($1, $2, 'available', 'standard')", [zoneId, `A-${String(i).padStart(2, '0')}`]);
        }
        res.status(201).json({
            status: 'success',
            data: { facility: newFacility },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.createFacility = createFacility;
const getFacilities = async (req, res, next) => {
    try {
        const facilities = await (0, database_1.query)(`SELECT * FROM parking_facilities 
       WHERE status = 'active' 
       ORDER BY rating DESC, name ASC`);
        res.status(200).json({
            status: 'success',
            data: { facilities: facilities.rows },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getFacilities = getFacilities;
const getFacilityById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const facilityRes = await (0, database_1.query)('SELECT * FROM parking_facilities WHERE id = $1', [id]);
        if (facilityRes.rows.length === 0) {
            return next(new appError_1.AppError('Parking facility not found.', 404));
        }
        res.status(200).json({
            status: 'success',
            data: { facility: facilityRes.rows[0] },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getFacilityById = getFacilityById;
const getFacilityReviews = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await (0, database_1.query)(`SELECT rv.id, rv.rating::float as rating, rv.comment, rv.created_at,
              u.name as "userName"
       FROM reviews rv
       JOIN users u ON u.id = rv.user_id
       WHERE rv.facility_id = $1
       ORDER BY rv.created_at DESC
       LIMIT 50`, [id]);
        res.status(200).json({
            status: 'success',
            data: { reviews: result.rows },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getFacilityReviews = getFacilityReviews;
const upsertFacilityReview = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        if (req.user.role !== 'DRIVER') {
            return next(new appError_1.AppError('Only drivers can review parking facilities.', 403));
        }
        const { id } = req.params;
        const validated = reviewSchema.parse(req.body);
        const facility = await (0, database_1.query)('SELECT id FROM parking_facilities WHERE id = $1', [id]);
        if (facility.rows.length === 0) {
            return next(new appError_1.AppError('Parking facility not found.', 404));
        }
        const result = await (0, database_1.query)(`INSERT INTO reviews (user_id, facility_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, facility_id)
       DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = CURRENT_TIMESTAMP
       RETURNING *`, [req.user.id, id, validated.rating, validated.comment || null]);
        await (0, database_1.query)(`UPDATE parking_facilities f
       SET rating = COALESCE(stats.avg_rating, 0),
           review_count = COALESCE(stats.review_count, 0),
           updated_at = CURRENT_TIMESTAMP
       FROM (
         SELECT facility_id, ROUND(AVG(rating)::numeric, 1) as avg_rating, COUNT(*)::int as review_count
         FROM reviews
         WHERE facility_id = $1
         GROUP BY facility_id
       ) stats
       WHERE f.id = stats.facility_id`, [id]);
        res.status(201).json({
            status: 'success',
            data: { review: result.rows[0] },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.upsertFacilityReview = upsertFacilityReview;
const updateFacility = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const { id } = req.params;
        const validated = facilityCreateSchema.parse(req.body);
        // Validate operator or admin ownership
        const facility = await (0, database_1.query)('SELECT id, operator_id FROM parking_facilities WHERE id = $1', [id]);
        if (facility.rows.length === 0) {
            return next(new appError_1.AppError('Facility not found.', 404));
        }
        if (req.user.role !== 'ADMIN' && facility.rows[0].operator_id !== req.user.id) {
            return next(new appError_1.AppError('Unauthorized access to update this facility.', 403));
        }
        const updated = await (0, database_1.query)(`UPDATE parking_facilities 
       SET name = $1, address = $2, latitude = $3, longitude = $4, total_spaces = $5, 
           price_per_hour = $6, type = $7, hours = $8, has_security = $9, image_url = $10, 
           amenities = $11, updated_at = CURRENT_TIMESTAMP
       WHERE id = $12
       RETURNING *`, [
            validated.name,
            validated.address,
            validated.latitude,
            validated.longitude,
            validated.totalSpaces,
            validated.pricePerHour,
            validated.type,
            validated.hours,
            validated.hasSecurity,
            validated.imageUrl || null,
            validated.amenities,
            id,
        ]);
        res.status(200).json({
            status: 'success',
            data: { facility: updated.rows[0] },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.updateFacility = updateFacility;
const deleteFacility = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const { id } = req.params;
        const facility = await (0, database_1.query)('SELECT id, operator_id FROM parking_facilities WHERE id = $1', [id]);
        if (facility.rows.length === 0) {
            return next(new appError_1.AppError('Facility not found.', 404));
        }
        if (req.user.role !== 'ADMIN' && facility.rows[0].operator_id !== req.user.id) {
            return next(new appError_1.AppError('Unauthorized access to delete this facility.', 403));
        }
        // Set status to rejected/inactive or delete it
        await (0, database_1.query)("UPDATE parking_facilities SET status = 'rejected' WHERE id = $1", [id]);
        res.status(200).json({
            status: 'success',
            message: 'Facility removed successfully.',
        });
    }
    catch (err) {
        next(err);
    }
};
exports.deleteFacility = deleteFacility;
// Phase 6 Maps Integration: Nearby facility search (Haversine formula)
const getNearbyFacilities = async (req, res, next) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);
        if (isNaN(lat) || isNaN(lng)) {
            return next(new appError_1.AppError('Latitude (lat) and Longitude (lng) query parameters are required.', 400));
        }
        // Haversine formula in PostgreSQL: 6371 * acos(...)
        // Calculates distance in KM
        const result = await (0, database_1.query)(`SELECT *,
        (6371 * acos(
          cos(radians($1)) * cos(radians(latitude)) * 
          cos(radians(longitude) - radians($2)) + 
          sin(radians($1)) * sin(radians(latitude))
        )) AS distance_km
       FROM parking_facilities
       WHERE status = 'active'
       ORDER BY distance_km ASC
       LIMIT 10`, [lat, lng]);
        // Estimate ETA based on typical Kampala speed (avg 25 km/h in city traffic)
        // eta = distance / speed * 60 minutes
        const facilities = result.rows.map((f) => {
            const distance = parseFloat(f.distance_km);
            const etaMin = Math.max(3, Math.round((distance / 25.0) * 60.0));
            return {
                ...f,
                distanceKm: Math.round(distance * 10) / 10,
                etaMin,
            };
        });
        res.status(200).json({
            status: 'success',
            data: { facilities },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getNearbyFacilities = getNearbyFacilities;
// Facility Search (by name or address keyword matching)
const searchFacilities = async (req, res, next) => {
    try {
        const q = req.query.q || '';
        const result = await (0, database_1.query)(`SELECT * FROM parking_facilities 
       WHERE status = 'active' AND (name ILIKE $1 OR address ILIKE $1)
       ORDER BY rating DESC`, [`%${q}%`]);
        res.status(200).json({
            status: 'success',
            data: { facilities: result.rows },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.searchFacilities = searchFacilities;
// Availability & Occupancy metrics by facility
const getFacilityAvailability = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Check if facility exists
        const facilityRes = await (0, database_1.query)('SELECT name, total_spaces FROM parking_facilities WHERE id = $1', [id]);
        if (facilityRes.rows.length === 0) {
            return next(new appError_1.AppError('Facility not found.', 404));
        }
        const facility = facilityRes.rows[0];
        // Query active spaces status
        const spacesRes = await (0, database_1.query)(`SELECT 
         COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
         COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied,
         COUNT(CASE WHEN status = 'reserved' THEN 1 END) as reserved
       FROM parking_spaces s
       JOIN parking_zones z ON s.zone_id = z.id
       WHERE z.facility_id = $1`, [id]);
        const spaceMetrics = spacesRes.rows[0];
        const available = parseInt(spaceMetrics.available || '0');
        const occupied = parseInt(spaceMetrics.occupied || '0');
        const reserved = parseInt(spaceMetrics.reserved || '0');
        // Make sure we update the available spaces cache on the facility table
        await (0, database_1.query)('UPDATE parking_facilities SET available_spaces = $1 WHERE id = $2', [available, id]);
        res.status(200).json({
            status: 'success',
            data: {
                facilityId: id,
                name: facility.name,
                totalSpaces: facility.total_spaces,
                availableSpaces: available,
                occupiedSpaces: occupied,
                reservedSpaces: reserved,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getFacilityAvailability = getFacilityAvailability;
