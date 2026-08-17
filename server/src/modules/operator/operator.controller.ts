import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool, query } from '../../config/database';
import { AppError } from '../../utils/appError';

const pricingRuleSchema = z.object({
  facilityId: z.string().uuid(),
  ruleName: z.string().min(2).max(50),
  ruleType: z.enum(['multiplier', 'flat']).default('multiplier'),
  ruleValue: z.coerce.number().positive(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const zoneSchema = z.object({
  facilityId: z.string().uuid(),
  name: z.string().min(1).max(50),
});

const spaceSchema = z.object({
  zoneId: z.string().uuid(),
  spaceNumber: z.string().min(1).max(20),
  type: z.enum(['standard', 'disabled', 'ev']).default('standard'),
  status: z.enum(['available', 'occupied', 'reserved']).default('available'),
});

const assertOperatorOwnsFacility = async (userId: string, facilityId: string) => {
  const result = await query(
    'SELECT id FROM parking_facilities WHERE id = $1 AND operator_id = $2',
    [facilityId, userId]
  );

  return result.rows.length > 0;
};

export const getOperatorDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));

    // Get list of facilities owned by the operator
    const facilitiesRes = await query(
      'SELECT id, name, total_spaces, available_spaces, price_per_hour FROM parking_facilities WHERE operator_id = $1',
      [req.user.id]
    );

    const facilities = facilitiesRes.rows;
    const facilityIds = facilities.map((f) => f.id);

    if (facilityIds.length === 0) {
      return res.status(200).json({
        status: 'success',
        data: {
          metrics: { revenueToday: 0, occupancyRate: 0, activeSessions: 0, reservationsCount: 0 },
          revenueData: [],
          occupancyData: [],
          paymentData: [{ name: 'Cash', value: 100, color: '#64748B' }],
          facilities: [],
        },
      });
    }

    // 1. Calculate Revenue Today
    const revRes = await query(
      `SELECT COALESCE(SUM(amount_charged), 0) as revenue 
       FROM parking_sessions 
       WHERE facility_id = ANY($1) 
         AND checkout_time >= CURRENT_DATE`,
      [facilityIds]
    );
    const revenueToday = parseInt(revRes.rows[0].revenue || '0');

    // 2. Occupancy Rate
    let totalCapacity = 0;
    let totalOccupied = 0;
    const occupancyData = [];

    for (const f of facilities) {
      totalCapacity += f.total_spaces;
      const occupiedCountRes = await query(
        `SELECT COUNT(s.id) as occupied
         FROM parking_spaces s
         JOIN parking_zones z ON s.zone_id = z.id
         WHERE z.facility_id = $1 AND s.status = 'occupied'`,
        [f.id]
      );
      const occupied = parseInt(occupiedCountRes.rows[0].occupied || '0');
      totalOccupied += occupied;

      occupancyData.push({
        name: f.name,
        occupancy: Math.round((occupied / f.total_spaces) * 100),
        capacity: f.total_spaces,
      });
    }
    const occupancyRate = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

    // 3. Active Sessions
    const activeSessRes = await query(
      `SELECT COUNT(id) as count 
       FROM parking_sessions 
       WHERE facility_id = ANY($1) AND status = 'active'`,
      [facilityIds]
    );
    const activeSessions = parseInt(activeSessRes.rows[0].count || '0');

    // 4. Reservations Count Today
    const resCountRes = await query(
      `SELECT COUNT(id) as count 
       FROM reservations 
       WHERE facility_id = ANY($1) 
         AND arrival_time >= CURRENT_DATE 
         AND arrival_time < CURRENT_DATE + INTERVAL '1 day'`,
      [facilityIds]
    );
    const reservationsCount = parseInt(resCountRes.rows[0].count || '0');

    // 5. Weekly Revenue Trend
    const trendRes = await query(
      `SELECT TO_CHAR(checkout_time, 'Dy') as day, COALESCE(SUM(amount_charged), 0) as revenue
       FROM parking_sessions
       WHERE facility_id = ANY($1) 
         AND checkout_time >= CURRENT_DATE - INTERVAL '6 days'
         AND status = 'completed'
       GROUP BY TO_CHAR(checkout_time, 'Dy'), DATE_TRUNC('day', checkout_time)
       ORDER BY DATE_TRUNC('day', checkout_time) ASC`,
      [facilityIds]
    );
    const revenueData = trendRes.rows;

    const paymentRes = await query(
      `SELECT provider, COUNT(*)::int as count
       FROM payments
       WHERE session_id IN (
         SELECT id FROM parking_sessions WHERE facility_id = ANY($1)
       )
       GROUP BY provider`,
      [facilityIds]
    );
    const providerColors: Record<string, string> = {
      cash: '#64748B',
      mtn: '#F4B400',
      airtel: '#DC2626',
    };
    const providerLabels: Record<string, string> = {
      cash: 'Cash',
      mtn: 'MTN MoMo',
      airtel: 'Airtel Money',
    };
    const paymentData = paymentRes.rows.length > 0
      ? paymentRes.rows.map((row) => ({
          name: providerLabels[row.provider] || row.provider,
          value: Number(row.count),
          color: providerColors[row.provider] || '#64748B',
        }))
      : [{ name: 'No payments', value: 1, color: '#CBD5E1' }];

    res.status(200).json({
      status: 'success',
      data: {
        metrics: {
          revenueToday,
          occupancyRate,
          activeSessions,
          reservationsCount,
        },
        revenueData,
        occupancyData,
        paymentData,
        facilities,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getOperatorFacilities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));

    const result = await query(
      `SELECT f.*, 
        COALESCE(space_stats.occupied, 0) as occupied,
        COALESCE(session_stats.revenue, 0) as revenue
       FROM parking_facilities f
       LEFT JOIN (
         SELECT z.facility_id, COUNT(*)::int as occupied
         FROM parking_spaces s
         JOIN parking_zones z ON z.id = s.zone_id
         WHERE s.status = 'occupied'
         GROUP BY z.facility_id
       ) space_stats ON space_stats.facility_id = f.id
       LEFT JOIN (
         SELECT facility_id, COALESCE(SUM(amount_charged), 0) as revenue
         FROM parking_sessions
         WHERE status = 'completed'
         GROUP BY facility_id
       ) session_stats ON session_stats.facility_id = f.id
       WHERE f.operator_id = $1
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );

    const facilities = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      spaces: row.total_spaces,
      occupied: parseInt(row.occupied || '0'),
      rate: row.price_per_hour,
      status: row.status,
      revenue: `UGX ${Number(row.revenue || 0).toLocaleString()}`,
    }));

    res.status(200).json({
      status: 'success',
      data: { facilities },
    });
  } catch (err) {
    next(err);
  }
};

export const getOperatorReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));

    // Fetch monthly report metrics
    const reportRes = await query(
      `SELECT TO_CHAR(checkout_time, 'Mon') as month, 
              COALESCE(SUM(amount_charged), 0) as revenue,
              COUNT(id) as sessions
       FROM parking_sessions
       WHERE facility_id IN (SELECT id FROM parking_facilities WHERE operator_id = $1)
         AND status = 'completed'
       GROUP BY TO_CHAR(checkout_time, 'Mon'), DATE_TRUNC('month', checkout_time)
       ORDER BY DATE_TRUNC('month', checkout_time) ASC`,
      [req.user.id]
    );

    res.status(200).json({
      status: 'success',
      data: {
        reports: reportRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getPricingRules = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));

    const result = await query(
      `SELECT pr.id, pr.facility_id as "facilityId", f.name as "facilityName",
              pr.rule_name as "ruleName", pr.rule_type as "ruleType",
              pr.rule_value::float as "ruleValue", pr.start_time as "startTime",
              pr.end_time as "endTime", pr.day_of_week as "dayOfWeek",
              pr.status, pr.created_at
       FROM pricing_rules pr
       JOIN parking_facilities f ON f.id = pr.facility_id
       WHERE f.operator_id = $1
       ORDER BY pr.created_at DESC`,
      [req.user.id]
    );

    res.status(200).json({
      status: 'success',
      data: { pricingRules: result.rows },
    });
  } catch (err) {
    next(err);
  }
};

export const createPricingRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    const validated = pricingRuleSchema.parse(req.body);

    const ownsFacility = await assertOperatorOwnsFacility(req.user.id, validated.facilityId);
    if (!ownsFacility && req.user.role !== 'ADMIN') {
      return next(new AppError('Unauthorized access to this facility.', 403));
    }

    const result = await query(
      `INSERT INTO pricing_rules (facility_id, rule_name, rule_type, rule_value, start_time, end_time, day_of_week, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, facility_id as "facilityId", rule_name as "ruleName", rule_type as "ruleType",
                 rule_value::float as "ruleValue", start_time as "startTime", end_time as "endTime",
                 day_of_week as "dayOfWeek", status, created_at`,
      [
        validated.facilityId,
        validated.ruleName,
        validated.ruleType,
        validated.ruleValue,
        validated.startTime || null,
        validated.endTime || null,
        validated.dayOfWeek ?? null,
        validated.status,
      ]
    );

    res.status(201).json({
      status: 'success',
      data: { pricingRule: result.rows[0] },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors[0].message, 400));
    }
    next(err);
  }
};

export const updatePricingRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    const validated = pricingRuleSchema.partial().parse(req.body);
    const { id } = req.params;

    const rule = await query(
      `SELECT pr.id, pr.facility_id
       FROM pricing_rules pr
       JOIN parking_facilities f ON f.id = pr.facility_id
       WHERE pr.id = $1 AND (f.operator_id = $2 OR $3 = 'ADMIN')`,
      [id, req.user.id, req.user.role]
    );
    if (rule.rows.length === 0) {
      return next(new AppError('Pricing rule not found or unauthorized.', 404));
    }

    const result = await query(
      `UPDATE pricing_rules
       SET rule_name = COALESCE($1, rule_name),
           rule_type = COALESCE($2, rule_type),
           rule_value = COALESCE($3, rule_value),
           start_time = COALESCE($4, start_time),
           end_time = COALESCE($5, end_time),
           day_of_week = COALESCE($6, day_of_week),
           status = COALESCE($7, status)
       WHERE id = $8
       RETURNING id, facility_id as "facilityId", rule_name as "ruleName", rule_type as "ruleType",
                 rule_value::float as "ruleValue", start_time as "startTime", end_time as "endTime",
                 day_of_week as "dayOfWeek", status, created_at`,
      [
        validated.ruleName ?? null,
        validated.ruleType ?? null,
        validated.ruleValue ?? null,
        validated.startTime ?? null,
        validated.endTime ?? null,
        validated.dayOfWeek ?? null,
        validated.status ?? null,
        id,
      ]
    );

    res.status(200).json({
      status: 'success',
      data: { pricingRule: result.rows[0] },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors[0].message, 400));
    }
    next(err);
  }
};

export const deletePricingRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    const result = await query(
      `DELETE FROM pricing_rules pr
       USING parking_facilities f
       WHERE pr.facility_id = f.id
         AND pr.id = $1
         AND (f.operator_id = $2 OR $3 = 'ADMIN')
       RETURNING pr.id`,
      [req.params.id, req.user.id, req.user.role]
    );

    if (result.rows.length === 0) {
      return next(new AppError('Pricing rule not found or unauthorized.', 404));
    }

    res.status(200).json({
      status: 'success',
      message: 'Pricing rule deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
};

export const getFacilityLayout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    const { facilityId } = req.params;

    const ownsFacility = await assertOperatorOwnsFacility(req.user.id, facilityId);
    if (!ownsFacility && req.user.role !== 'ADMIN') {
      return next(new AppError('Unauthorized access to this facility.', 403));
    }

    const zones = await query(
      `SELECT id, name, created_at
       FROM parking_zones
       WHERE facility_id = $1
       ORDER BY name ASC`,
      [facilityId]
    );
    const spaces = await query(
      `SELECT s.id, s.zone_id as "zoneId", s.space_number as "spaceNumber", s.status, s.type
       FROM parking_spaces s
       JOIN parking_zones z ON z.id = s.zone_id
       WHERE z.facility_id = $1
       ORDER BY z.name ASC, s.space_number ASC`,
      [facilityId]
    );

    res.status(200).json({
      status: 'success',
      data: { zones: zones.rows, spaces: spaces.rows },
    });
  } catch (err) {
    next(err);
  }
};

export const createZone = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    const validated = zoneSchema.parse(req.body);

    const ownsFacility = await assertOperatorOwnsFacility(req.user.id, validated.facilityId);
    if (!ownsFacility && req.user.role !== 'ADMIN') {
      return next(new AppError('Unauthorized access to this facility.', 403));
    }

    const result = await query(
      'INSERT INTO parking_zones (facility_id, name) VALUES ($1, $2) RETURNING id, facility_id as "facilityId", name',
      [validated.facilityId, validated.name]
    );

    res.status(201).json({
      status: 'success',
      data: { zone: result.rows[0] },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors[0].message, 400));
    }
    next(err);
  }
};

export const createSpace = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    const validated = spaceSchema.parse(req.body);

    const zone = await query(
      `SELECT z.id, z.facility_id
       FROM parking_zones z
       JOIN parking_facilities f ON f.id = z.facility_id
       WHERE z.id = $1 AND (f.operator_id = $2 OR $3 = 'ADMIN')`,
      [validated.zoneId, req.user.id, req.user.role]
    );
    if (zone.rows.length === 0) {
      return next(new AppError('Zone not found or unauthorized.', 404));
    }

    const result = await query(
      `INSERT INTO parking_spaces (zone_id, space_number, status, type)
       VALUES ($1, $2, $3, $4)
       RETURNING id, zone_id as "zoneId", space_number as "spaceNumber", status, type`,
      [validated.zoneId, validated.spaceNumber, validated.status, validated.type]
    );

    await query(
      `UPDATE parking_facilities
       SET total_spaces = total_spaces + 1,
           available_spaces = available_spaces + CASE WHEN $1 = 'available' THEN 1 ELSE 0 END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [validated.status, zone.rows[0].facility_id]
    );

    res.status(201).json({
      status: 'success',
      data: { space: result.rows[0] },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors[0].message, 400));
    }
    next(err);
  }
};

const createAttendantSchema = z.object({
  facilityId: z.string().uuid('Invalid facility ID'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  shiftInfo: z.string().optional(),
});

export const getOperatorAttendants = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));

    let queryStr = `
      SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at as "createdAt",
             ap.id as "profileId", ap.facility_id as "facilityId", ap.shift_info as "shiftInfo",
             f.name as "facilityName"
      FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN attendant_profiles ap ON ap.user_id = u.id
      JOIN parking_facilities f ON ap.facility_id = f.id
    `;
    const params: unknown[] = [];

    if (req.user.role === 'OPERATOR') {
      queryStr += ' WHERE f.operator_id = $1';
      params.push(req.user.id);
    }

    queryStr += ' ORDER BY u.created_at DESC';

    const result = await query(queryStr, params);

    res.status(200).json({
      status: 'success',
      data: { attendants: result.rows },
    });
  } catch (err) {
    next(err);
  }
};

export const createOperatorAttendant = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    const validated = createAttendantSchema.parse(req.body);

    // 1. Verify that operator owns the target facility (or is ADMIN)
    if (req.user.role === 'OPERATOR') {
      const owns = await assertOperatorOwnsFacility(req.user.id, validated.facilityId);
      if (!owns) {
        return next(new AppError('You do not own this parking facility.', 403));
      }
    }

    // 2. Check if email exists
    const userCheck = await client.query('SELECT id FROM users WHERE email = $1', [validated.email.toLowerCase()]);
    if (userCheck.rows.length > 0) {
      return next(new AppError('A user with this email address already exists.', 400));
    }

    // 3. Get ATTENDANT role ID
    const roleRes = await client.query("SELECT id FROM roles WHERE name = 'ATTENDANT'");
    if (roleRes.rows.length === 0) {
      return next(new AppError('Attendant role not configured.', 500));
    }
    const roleId = roleRes.rows[0].id;

    // 4. Hash password
    const passwordHash = await bcrypt.hash(validated.password, 12);

    await client.query('BEGIN');

    // 5. Create user
    const userRes = await client.query(
      `INSERT INTO users (role_id, name, email, phone, password_hash, status, is_verified)
       VALUES ($1, $2, $3, $4, $5, 'active', true)
       RETURNING id, name, email, phone, status, created_at as "createdAt"`,
      [roleId, validated.name, validated.email.toLowerCase(), validated.phone || null, passwordHash]
    );
    const newUser = userRes.rows[0];

    // 6. Create attendant profile linked to facility
    const profileRes = await client.query(
      `INSERT INTO attendant_profiles (user_id, facility_id, shift_info)
       VALUES ($1, $2, $3)
       RETURNING id as "profileId", facility_id as "facilityId", shift_info as "shiftInfo"`,
      [newUser.id, validated.facilityId, validated.shiftInfo || 'Day Shift (8AM - 5PM)']
    );
    const newProfile = profileRes.rows[0];

    // Fetch facility name
    const facRes = await client.query('SELECT name FROM parking_facilities WHERE id = $1', [validated.facilityId]);
    const facilityName = facRes.rows[0]?.name || '';

    await client.query('COMMIT');

    res.status(201).json({
      status: 'success',
      message: 'Attendant successfully registered and assigned.',
      data: {
        attendant: {
          ...newUser,
          ...newProfile,
          facilityName,
        },
      },
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

export const deleteOperatorAttendant = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));
    const { id } = req.params;

    // Verify attendant belongs to operator's facility
    const attendantCheck = await client.query(
      `SELECT ap.id, ap.user_id, f.id as facility_id, f.operator_id
       FROM attendant_profiles ap
       JOIN parking_facilities f ON ap.facility_id = f.id
       WHERE ap.user_id = $1`,
      [id]
    );

    if (attendantCheck.rows.length === 0) {
      return next(new AppError('Attendant not found.', 404));
    }

    const attendant = attendantCheck.rows[0];

    if (req.user.role === 'OPERATOR' && attendant.operator_id !== req.user.id) {
      return next(new AppError('Unauthorized to manage this attendant.', 403));
    }

    await client.query('BEGIN');
    // Cascade will remove attendant_profiles, or delete user directly
    await client.query('DELETE FROM users WHERE id = $1', [id]);
    await client.query('COMMIT');

    res.status(200).json({
      status: 'success',
      message: 'Attendant removed successfully.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

