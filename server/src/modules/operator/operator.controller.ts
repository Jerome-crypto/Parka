import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/database';
import { AppError } from '../../utils/appError';

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
        paymentData: [
          { name: 'Cash', value: 100, color: '#64748B' }, // Cash only for now
        ],
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
        COUNT(CASE WHEN s.status = 'occupied' THEN 1 END) as occupied
       FROM parking_facilities f
       LEFT JOIN parking_zones z ON z.facility_id = f.id
       LEFT JOIN parking_spaces s ON s.zone_id = z.id
       WHERE f.operator_id = $1
       GROUP BY f.id
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
      revenue: `UGX 0`, // Placeholder or calculate it
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
