import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import { verifyAccessToken } from '../utils/jwt';
import { query } from '../config/database';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  facilityId?: string;
  facilityName?: string;
  shiftInfo?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Get token from header
    let token: string | undefined;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }

    // 2. Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return next(new AppError('Invalid token or token has expired.', 401));
    }

    // 3. Check if user still exists
    const userRes = await query(
      `SELECT u.id, u.email, u.name, u.status, r.name as role,
              ap.facility_id as "facilityId", ap.shift_info as "shiftInfo",
              f.name as "facilityName"
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       LEFT JOIN attendant_profiles ap ON u.id = ap.user_id
       LEFT JOIN parking_facilities f ON ap.facility_id = f.id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (userRes.rows.length === 0) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    const user = userRes.rows[0];

    // 4. Check if user is suspended
    if (user.status === 'suspended') {
      return next(new AppError('This user account has been suspended.', 403));
    }

    // 5. Grant access
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      facilityId: user.facilityId || undefined,
      facilityName: user.facilityName || undefined,
      shiftInfo: user.shiftInfo || undefined,
    };

    next();
  } catch (err) {
    next(err);
  }
};

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};
