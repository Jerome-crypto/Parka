import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../../config/database';
import { AppError } from '../../utils/appError';

const facilityCreateSchema = z.object({
  name: z.string().min(3),
  address: z.string().min(5),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  totalSpaces: z.coerce.number().int().positive(),
  pricePerHour: z.coerce.number().int().positive(),
  type: z.enum(['covered', 'open', 'multi-story']),
  hours: z.string().default('24/7'),
  hasSecurity: z.boolean().default(true),
  imageUrl: z.string().url().optional(),
  amenities: z.array(z.string()).default([]),
});

export const createFacility = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    const validated = facilityCreateSchema.parse(req.body);

    const result = await query(
      `INSERT INTO parking_facilities (
        operator_id, name, address, latitude, longitude, total_spaces, 
        available_spaces, price_per_hour, type, hours, has_security, image_url, amenities, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11, $12, 'pending')
       RETURNING *`,
      [
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
      ]
    );

    const newFacility = result.rows[0];

    // Seed default Zone & spaces for this new facility
    const zoneRes = await query(
      "INSERT INTO parking_zones (facility_id, name) VALUES ($1, 'Zone A') RETURNING id",
      [newFacility.id]
    );
    const zoneId = zoneRes.rows[0].id;

    for (let i = 1; i <= Math.min(validated.totalSpaces, 20); i++) {
      await query(
        "INSERT INTO parking_spaces (zone_id, space_number, status, type) VALUES ($1, $2, 'available', 'standard')",
        [zoneId, `A-${String(i).padStart(2, '0')}`]
      );
    }

    res.status(201).json({
      status: 'success',
      data: { facility: newFacility },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors[0].message, 400));
    }
    next(err);
  }
};

export const getFacilities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const facilities = await query(
      `SELECT * FROM parking_facilities 
       WHERE status = 'active' 
       ORDER BY rating DESC, name ASC`
    );

    res.status(200).json({
      status: 'success',
      data: { facilities: facilities.rows },
    });
  } catch (err) {
    next(err);
  }
};

export const getFacilityById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const facilityRes = await query('SELECT * FROM parking_facilities WHERE id = $1', [id]);

    if (facilityRes.rows.length === 0) {
      return next(new AppError('Parking facility not found.', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { facility: facilityRes.rows[0] },
    });
  } catch (err) {
    next(err);
  }
};

export const updateFacility = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    const { id } = req.params;
    const validated = facilityCreateSchema.parse(req.body);

    // Validate operator or admin ownership
    const facility = await query('SELECT id, operator_id FROM parking_facilities WHERE id = $1', [id]);
    if (facility.rows.length === 0) {
      return next(new AppError('Facility not found.', 404));
    }

    if (req.user.role !== 'ADMIN' && facility.rows[0].operator_id !== req.user.id) {
      return next(new AppError('Unauthorized access to update this facility.', 403));
    }

    const updated = await query(
      `UPDATE parking_facilities 
       SET name = $1, address = $2, latitude = $3, longitude = $4, total_spaces = $5, 
           price_per_hour = $6, type = $7, hours = $8, has_security = $9, image_url = $10, 
           amenities = $11, updated_at = CURRENT_TIMESTAMP
       WHERE id = $12
       RETURNING *`,
      [
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
      ]
    );

    res.status(200).json({
      status: 'success',
      data: { facility: updated.rows[0] },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors[0].message, 400));
    }
    next(err);
  }
};

export const deleteFacility = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    const { id } = req.params;

    const facility = await query('SELECT id, operator_id FROM parking_facilities WHERE id = $1', [id]);
    if (facility.rows.length === 0) {
      return next(new AppError('Facility not found.', 404));
    }

    if (req.user.role !== 'ADMIN' && facility.rows[0].operator_id !== req.user.id) {
      return next(new AppError('Unauthorized access to delete this facility.', 403));
    }

    // Set status to rejected/inactive or delete it
    await query("UPDATE parking_facilities SET status = 'rejected' WHERE id = $1", [id]);

    res.status(200).json({
      status: 'success',
      message: 'Facility removed successfully.',
    });
  } catch (err) {
    next(err);
  }
};

// Phase 6 Maps Integration: Nearby facility search (Haversine formula)
export const getNearbyFacilities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      return next(new AppError('Latitude (lat) and Longitude (lng) query parameters are required.', 400));
    }

    // Haversine formula in PostgreSQL: 6371 * acos(...)
    // Calculates distance in KM
    const result = await query(
      `SELECT *,
        (6371 * acos(
          cos(radians($1)) * cos(radians(latitude)) * 
          cos(radians(longitude) - radians($2)) + 
          sin(radians($1)) * sin(radians(latitude))
        )) AS distance_km
       FROM parking_facilities
       WHERE status = 'active'
       ORDER BY distance_km ASC
       LIMIT 10`,
      [lat, lng]
    );

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
  } catch (err) {
    next(err);
  }
};

// Facility Search (by name or address keyword matching)
export const searchFacilities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q as string || '';

    const result = await query(
      `SELECT * FROM parking_facilities 
       WHERE status = 'active' AND (name ILIKE $1 OR address ILIKE $1)
       ORDER BY rating DESC`,
      [`%${q}%`]
    );

    res.status(200).json({
      status: 'success',
      data: { facilities: result.rows },
    });
  } catch (err) {
    next(err);
  }
};

// Availability & Occupancy metrics by facility
export const getFacilityAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check if facility exists
    const facilityRes = await query('SELECT name, total_spaces FROM parking_facilities WHERE id = $1', [id]);
    if (facilityRes.rows.length === 0) {
      return next(new AppError('Facility not found.', 404));
    }

    const facility = facilityRes.rows[0];

    // Query active spaces status
    const spacesRes = await query(
      `SELECT 
         COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
         COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied,
         COUNT(CASE WHEN status = 'reserved' THEN 1 END) as reserved
       FROM parking_spaces s
       JOIN parking_zones z ON s.zone_id = z.id
       WHERE z.facility_id = $1`,
      [id]
    );

    const spaceMetrics = spacesRes.rows[0];
    const available = parseInt(spaceMetrics.available || '0');
    const occupied = parseInt(spaceMetrics.occupied || '0');
    const reserved = parseInt(spaceMetrics.reserved || '0');

    // Make sure we update the available spaces cache on the facility table
    await query(
      'UPDATE parking_facilities SET available_spaces = $1 WHERE id = $2',
      [available, id]
    );

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
  } catch (err) {
    next(err);
  }
};
