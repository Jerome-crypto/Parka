"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSpace = exports.createZone = exports.getFacilityLayout = exports.deletePricingRule = exports.updatePricingRule = exports.createPricingRule = exports.getPricingRules = exports.getOperatorReports = exports.getOperatorFacilities = exports.getOperatorDashboard = void 0;
const zod_1 = require("zod");
const database_1 = require("../../config/database");
const appError_1 = require("../../utils/appError");
const pricingRuleSchema = zod_1.z.object({
    facilityId: zod_1.z.string().uuid(),
    ruleName: zod_1.z.string().min(2).max(50),
    ruleType: zod_1.z.enum(['multiplier', 'flat']).default('multiplier'),
    ruleValue: zod_1.z.coerce.number().positive(),
    startTime: zod_1.z.string().optional(),
    endTime: zod_1.z.string().optional(),
    dayOfWeek: zod_1.z.coerce.number().int().min(0).max(6).optional(),
    status: zod_1.z.enum(['active', 'inactive']).default('active'),
});
const zoneSchema = zod_1.z.object({
    facilityId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(50),
});
const spaceSchema = zod_1.z.object({
    zoneId: zod_1.z.string().uuid(),
    spaceNumber: zod_1.z.string().min(1).max(20),
    type: zod_1.z.enum(['standard', 'disabled', 'ev']).default('standard'),
    status: zod_1.z.enum(['available', 'occupied', 'reserved']).default('available'),
});
const assertOperatorOwnsFacility = async (userId, facilityId) => {
    const result = await (0, database_1.query)('SELECT id FROM parking_facilities WHERE id = $1 AND operator_id = $2', [facilityId, userId]);
    return result.rows.length > 0;
};
const getOperatorDashboard = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        // Get list of facilities owned by the operator
        const facilitiesRes = await (0, database_1.query)('SELECT id, name, total_spaces, available_spaces, price_per_hour FROM parking_facilities WHERE operator_id = $1', [req.user.id]);
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
        const revRes = await (0, database_1.query)(`SELECT COALESCE(SUM(amount_charged), 0) as revenue 
       FROM parking_sessions 
       WHERE facility_id = ANY($1) 
         AND checkout_time >= CURRENT_DATE`, [facilityIds]);
        const revenueToday = parseInt(revRes.rows[0].revenue || '0');
        // 2. Occupancy Rate
        let totalCapacity = 0;
        let totalOccupied = 0;
        const occupancyData = [];
        for (const f of facilities) {
            totalCapacity += f.total_spaces;
            const occupiedCountRes = await (0, database_1.query)(`SELECT COUNT(s.id) as occupied
         FROM parking_spaces s
         JOIN parking_zones z ON s.zone_id = z.id
         WHERE z.facility_id = $1 AND s.status = 'occupied'`, [f.id]);
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
        const activeSessRes = await (0, database_1.query)(`SELECT COUNT(id) as count 
       FROM parking_sessions 
       WHERE facility_id = ANY($1) AND status = 'active'`, [facilityIds]);
        const activeSessions = parseInt(activeSessRes.rows[0].count || '0');
        // 4. Reservations Count Today
        const resCountRes = await (0, database_1.query)(`SELECT COUNT(id) as count 
       FROM reservations 
       WHERE facility_id = ANY($1) 
         AND arrival_time >= CURRENT_DATE 
         AND arrival_time < CURRENT_DATE + INTERVAL '1 day'`, [facilityIds]);
        const reservationsCount = parseInt(resCountRes.rows[0].count || '0');
        // 5. Weekly Revenue Trend
        const trendRes = await (0, database_1.query)(`SELECT TO_CHAR(checkout_time, 'Dy') as day, COALESCE(SUM(amount_charged), 0) as revenue
       FROM parking_sessions
       WHERE facility_id = ANY($1) 
         AND checkout_time >= CURRENT_DATE - INTERVAL '6 days'
         AND status = 'completed'
       GROUP BY TO_CHAR(checkout_time, 'Dy'), DATE_TRUNC('day', checkout_time)
       ORDER BY DATE_TRUNC('day', checkout_time) ASC`, [facilityIds]);
        const revenueData = trendRes.rows;
        const paymentRes = await (0, database_1.query)(`SELECT provider, COUNT(*)::int as count
       FROM payments
       WHERE session_id IN (
         SELECT id FROM parking_sessions WHERE facility_id = ANY($1)
       )
       GROUP BY provider`, [facilityIds]);
        const providerColors = {
            cash: '#64748B',
            mtn: '#F4B400',
            airtel: '#DC2626',
        };
        const providerLabels = {
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
    }
    catch (err) {
        next(err);
    }
};
exports.getOperatorDashboard = getOperatorDashboard;
const getOperatorFacilities = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const result = await (0, database_1.query)(`SELECT f.*, 
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
       ORDER BY f.created_at DESC`, [req.user.id]);
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
    }
    catch (err) {
        next(err);
    }
};
exports.getOperatorFacilities = getOperatorFacilities;
const getOperatorReports = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        // Fetch monthly report metrics
        const reportRes = await (0, database_1.query)(`SELECT TO_CHAR(checkout_time, 'Mon') as month, 
              COALESCE(SUM(amount_charged), 0) as revenue,
              COUNT(id) as sessions
       FROM parking_sessions
       WHERE facility_id IN (SELECT id FROM parking_facilities WHERE operator_id = $1)
         AND status = 'completed'
       GROUP BY TO_CHAR(checkout_time, 'Mon'), DATE_TRUNC('month', checkout_time)
       ORDER BY DATE_TRUNC('month', checkout_time) ASC`, [req.user.id]);
        res.status(200).json({
            status: 'success',
            data: {
                reports: reportRes.rows,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getOperatorReports = getOperatorReports;
const getPricingRules = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const result = await (0, database_1.query)(`SELECT pr.id, pr.facility_id as "facilityId", f.name as "facilityName",
              pr.rule_name as "ruleName", pr.rule_type as "ruleType",
              pr.rule_value::float as "ruleValue", pr.start_time as "startTime",
              pr.end_time as "endTime", pr.day_of_week as "dayOfWeek",
              pr.status, pr.created_at
       FROM pricing_rules pr
       JOIN parking_facilities f ON f.id = pr.facility_id
       WHERE f.operator_id = $1
       ORDER BY pr.created_at DESC`, [req.user.id]);
        res.status(200).json({
            status: 'success',
            data: { pricingRules: result.rows },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getPricingRules = getPricingRules;
const createPricingRule = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const validated = pricingRuleSchema.parse(req.body);
        const ownsFacility = await assertOperatorOwnsFacility(req.user.id, validated.facilityId);
        if (!ownsFacility && req.user.role !== 'ADMIN') {
            return next(new appError_1.AppError('Unauthorized access to this facility.', 403));
        }
        const result = await (0, database_1.query)(`INSERT INTO pricing_rules (facility_id, rule_name, rule_type, rule_value, start_time, end_time, day_of_week, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, facility_id as "facilityId", rule_name as "ruleName", rule_type as "ruleType",
                 rule_value::float as "ruleValue", start_time as "startTime", end_time as "endTime",
                 day_of_week as "dayOfWeek", status, created_at`, [
            validated.facilityId,
            validated.ruleName,
            validated.ruleType,
            validated.ruleValue,
            validated.startTime || null,
            validated.endTime || null,
            validated.dayOfWeek ?? null,
            validated.status,
        ]);
        res.status(201).json({
            status: 'success',
            data: { pricingRule: result.rows[0] },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.createPricingRule = createPricingRule;
const updatePricingRule = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const validated = pricingRuleSchema.partial().parse(req.body);
        const { id } = req.params;
        const rule = await (0, database_1.query)(`SELECT pr.id, pr.facility_id
       FROM pricing_rules pr
       JOIN parking_facilities f ON f.id = pr.facility_id
       WHERE pr.id = $1 AND (f.operator_id = $2 OR $3 = 'ADMIN')`, [id, req.user.id, req.user.role]);
        if (rule.rows.length === 0) {
            return next(new appError_1.AppError('Pricing rule not found or unauthorized.', 404));
        }
        const result = await (0, database_1.query)(`UPDATE pricing_rules
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
                 day_of_week as "dayOfWeek", status, created_at`, [
            validated.ruleName ?? null,
            validated.ruleType ?? null,
            validated.ruleValue ?? null,
            validated.startTime ?? null,
            validated.endTime ?? null,
            validated.dayOfWeek ?? null,
            validated.status ?? null,
            id,
        ]);
        res.status(200).json({
            status: 'success',
            data: { pricingRule: result.rows[0] },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.updatePricingRule = updatePricingRule;
const deletePricingRule = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const result = await (0, database_1.query)(`DELETE FROM pricing_rules pr
       USING parking_facilities f
       WHERE pr.facility_id = f.id
         AND pr.id = $1
         AND (f.operator_id = $2 OR $3 = 'ADMIN')
       RETURNING pr.id`, [req.params.id, req.user.id, req.user.role]);
        if (result.rows.length === 0) {
            return next(new appError_1.AppError('Pricing rule not found or unauthorized.', 404));
        }
        res.status(200).json({
            status: 'success',
            message: 'Pricing rule deleted successfully.',
        });
    }
    catch (err) {
        next(err);
    }
};
exports.deletePricingRule = deletePricingRule;
const getFacilityLayout = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const { facilityId } = req.params;
        const ownsFacility = await assertOperatorOwnsFacility(req.user.id, facilityId);
        if (!ownsFacility && req.user.role !== 'ADMIN') {
            return next(new appError_1.AppError('Unauthorized access to this facility.', 403));
        }
        const zones = await (0, database_1.query)(`SELECT id, name, created_at
       FROM parking_zones
       WHERE facility_id = $1
       ORDER BY name ASC`, [facilityId]);
        const spaces = await (0, database_1.query)(`SELECT s.id, s.zone_id as "zoneId", s.space_number as "spaceNumber", s.status, s.type
       FROM parking_spaces s
       JOIN parking_zones z ON z.id = s.zone_id
       WHERE z.facility_id = $1
       ORDER BY z.name ASC, s.space_number ASC`, [facilityId]);
        res.status(200).json({
            status: 'success',
            data: { zones: zones.rows, spaces: spaces.rows },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getFacilityLayout = getFacilityLayout;
const createZone = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const validated = zoneSchema.parse(req.body);
        const ownsFacility = await assertOperatorOwnsFacility(req.user.id, validated.facilityId);
        if (!ownsFacility && req.user.role !== 'ADMIN') {
            return next(new appError_1.AppError('Unauthorized access to this facility.', 403));
        }
        const result = await (0, database_1.query)('INSERT INTO parking_zones (facility_id, name) VALUES ($1, $2) RETURNING id, facility_id as "facilityId", name', [validated.facilityId, validated.name]);
        res.status(201).json({
            status: 'success',
            data: { zone: result.rows[0] },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.createZone = createZone;
const createSpace = async (req, res, next) => {
    try {
        if (!req.user)
            return next(new appError_1.AppError('Unauthorized', 401));
        const validated = spaceSchema.parse(req.body);
        const zone = await (0, database_1.query)(`SELECT z.id, z.facility_id
       FROM parking_zones z
       JOIN parking_facilities f ON f.id = z.facility_id
       WHERE z.id = $1 AND (f.operator_id = $2 OR $3 = 'ADMIN')`, [validated.zoneId, req.user.id, req.user.role]);
        if (zone.rows.length === 0) {
            return next(new appError_1.AppError('Zone not found or unauthorized.', 404));
        }
        const result = await (0, database_1.query)(`INSERT INTO parking_spaces (zone_id, space_number, status, type)
       VALUES ($1, $2, $3, $4)
       RETURNING id, zone_id as "zoneId", space_number as "spaceNumber", status, type`, [validated.zoneId, validated.spaceNumber, validated.status, validated.type]);
        await (0, database_1.query)(`UPDATE parking_facilities
       SET total_spaces = total_spaces + 1,
           available_spaces = available_spaces + CASE WHEN $1 = 'available' THEN 1 ELSE 0 END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`, [validated.status, zone.rows[0].facility_id]);
        res.status(201).json({
            status: 'success',
            data: { space: result.rows[0] },
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return next(new appError_1.AppError(err.errors[0].message, 400));
        }
        next(err);
    }
};
exports.createSpace = createSpace;
