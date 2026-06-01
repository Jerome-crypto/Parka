import { createReservation } from './reservation.controller';
import { Request, Response, NextFunction } from 'express';
import { pool } from '../../config/database';

jest.mock('../../config/database', () => ({
  pool: {
    connect: jest.fn(),
  },
  query: jest.fn(),
}));

jest.mock('../../services/notificationService', () => ({
  createNotification: jest.fn(),
}));

jest.mock('../../services/socketService', () => ({
  emitFacilityUpdate: jest.fn(),
}));

describe('Reservation Controller - createReservation', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let mockClient: any;

  beforeEach(() => {
    nextFunction = jest.fn();
    mockRequest = {
      user: {
        id: 'user-id-123',
        email: 'test@email.com',
        name: 'Test User',
        role: 'DRIVER',
      },
      body: {
        facilityId: '00000000-0000-0000-0000-000000000001',
        vehicleId: '00000000-0000-0000-0000-000000000002',
        arrivalTime: new Date(Date.now() + 1000 * 60 * 60).toISOString(), // 1 hour in the future
        durationHours: 2,
      },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully create a reservation if spaces are available', async () => {
    mockClient.query.mockImplementation(async (text: string) => {
      const queryStr = text.toLowerCase();

      if (queryStr.includes('begin') || queryStr.includes('commit') || queryStr.includes('rollback')) {
        return {};
      }
      if (queryStr.includes('parking_facilities') && queryStr.includes('select')) {
        return {
          rows: [{ id: 'fac-1', name: 'Garden City', available_spaces: 10, price_per_hour: 2000 }],
        };
      }
      if (queryStr.includes('parking_spaces') && queryStr.includes('select')) {
        return {
          rows: [{ id: 'space-1', space_number: 'A-01', zone_name: 'Zone A' }],
        };
      }
      if (queryStr.includes('vehicles') && queryStr.includes('select')) {
        return {
          rows: [{ id: 'veh-1', plate: 'UAB 123X' }],
        };
      }
      if (queryStr.includes('insert into reservations')) {
        return {
          rows: [{
            id: 'res-1',
            code: 'RES-TEST',
            driver_id: 'user-id-123',
            facility_id: 'fac-1',
            vehicle_id: 'veh-1',
            space_id: 'space-1',
            arrival_time: new Date(),
            duration_hours: 2,
            amount: 4000,
            status: 'upcoming',
            qr_code_token: 'token-abc',
          }],
        };
      }
      return { rows: [] };
    });

    await createReservation(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockResponse.status).toHaveBeenCalledWith(201);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
    }));
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should fail and rollback if facility has no available spaces', async () => {
    mockClient.query.mockImplementation(async (text: string) => {
      const queryStr = text.toLowerCase();

      if (queryStr.includes('begin') || queryStr.includes('commit') || queryStr.includes('rollback')) {
        return {};
      }
      if (queryStr.includes('parking_facilities') && queryStr.includes('select')) {
        return {
          rows: [{ id: 'fac-1', name: 'Garden City', available_spaces: 0, price_per_hour: 2000 }],
        };
      }
      return { rows: [] };
    });

    await createReservation(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(nextFunction).toHaveBeenCalledWith(expect.any(Error));
    expect(mockClient.release).toHaveBeenCalled();
  });
});
