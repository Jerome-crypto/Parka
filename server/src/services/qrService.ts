import jwt from 'jsonwebtoken';
import { env } from '../config/env';

interface QRData {
  reservationId: string;
  facilityId: string;
  driverId: string;
  arrivalTime: string;
}

export const generateQRToken = (data: QRData): string => {
  // Sign QR data with the JWT Secret
  // No expiration or long expiration (e.g. 24 hours relative to arrival time)
  return jwt.sign(data, env.JWT_SECRET);
};

export const verifyQRToken = (token: string): QRData => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as QRData;
  } catch {
    throw new Error('Invalid or tampered QR code token.');
  }
};
