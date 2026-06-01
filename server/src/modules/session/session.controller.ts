import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/database';
import { AppError } from '../../utils/appError';

export const getSessions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return next(new AppError('Unauthorized', 401));

    let queryStr = `
      SELECT s.*, f.name as "facilityName", ps.space_number as "spaceNumber", u.name as "driverName"
      FROM parking_sessions s
      JOIN parking_facilities f ON s.facility_id = f.id
      LEFT JOIN parking_spaces ps ON s.space_id = ps.id
      LEFT JOIN reservations r ON s.reservation_id = r.id
      LEFT JOIN users u ON r.driver_id = u.id
    `;
    const queryParams: unknown[] = [];

    // Filter by role
    if (req.user.role === 'DRIVER') {
      // Driver matches via reservations table
      queryStr += `
        WHERE r.driver_id = $1
      `;
      queryParams.push(req.user.id);
    } else if (req.user.role === 'ATTENDANT') {
      const attendantRes = await query('SELECT facility_id FROM attendant_profiles WHERE user_id = $1', [req.user.id]);
      if (attendantRes.rows.length > 0 && attendantRes.rows[0].facility_id) {
        queryStr += ' WHERE s.facility_id = $1';
        queryParams.push(attendantRes.rows[0].facility_id);
      }
    } else if (req.user.role === 'OPERATOR') {
      queryStr += ' WHERE f.operator_id = $1';
      queryParams.push(req.user.id);
    }

    queryStr += ' ORDER BY s.created_at DESC';

    const result = await query(queryStr, queryParams);

    res.status(200).json({
      status: 'success',
      data: { sessions: result.rows },
    });
  } catch (err) {
    next(err);
  }
};
