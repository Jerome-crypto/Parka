import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

export const seedDatabase = async () => {
  logger.info('Seeding database with test data...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Truncate all tables to prevent duplicates
    await client.query(`
      TRUNCATE TABLE 
        refresh_tokens, system_logs, audit_logs, reviews, notifications, 
        receipts, payments, parking_sessions, reservation_statuses, 
        reservations, pricing_rules, facility_images, vehicles, 
        parking_spaces, parking_zones, attendant_profiles, 
        parking_facilities, operator_profiles, driver_profiles, 
        users, roles 
      CASCADE
    `);

    logger.info('Cleaned existing database tables.');

    // 2. Seed Roles
    const rolesResult = await client.query(`
      INSERT INTO roles (name) VALUES 
        ('ADMIN'), ('OPERATOR'), ('ATTENDANT'), ('DRIVER')
      RETURNING id, name
    `);
    
    const roleMap: Record<string, string> = {};
    rolesResult.rows.forEach((row) => {
      roleMap[row.name] = row.id;
    });

    logger.info('Seeded user roles.');

    // Hash passwords
    const passwordHash = await bcrypt.hash('Password123', 10);

    // 3. Seed Users
    // Drivers
    const driverUser = await client.query(`
      INSERT INTO users (role_id, name, email, phone, password_hash, is_verified, status)
      VALUES ($1, 'Aisha Nakato', 'aisha.n@email.com', '+256701234567', $2, true, 'active')
      RETURNING id
    `, [roleMap['DRIVER'], passwordHash]);
    const driverId = driverUser.rows[0].id;

    await client.query(`
      INSERT INTO driver_profiles (user_id, license_number, balance_ugx)
      VALUES ($1, 'DL-39281A', 50000)
    `, [driverId]);

    // Operators
    const operatorUser = await client.query(`
      INSERT INTO users (role_id, name, email, phone, password_hash, is_verified, status)
      VALUES ($1, 'David Kiggundu', 'david.k@email.com', '+256752890123', $2, true, 'active')
      RETURNING id
    `, [roleMap['OPERATOR'], passwordHash]);
    const operatorId = operatorUser.rows[0].id;

    await client.query(`
      INSERT INTO operator_profiles (user_id, company_name, business_license)
      VALUES ($1, 'City Park Solutions', 'BL-98127-CPS')
    `, [operatorId]);

    // Attendants
    const attendantUser1 = await client.query(`
      INSERT INTO users (role_id, name, email, phone, password_hash, is_verified, status)
      VALUES ($1, 'Robert Ssekandi', 'robert.s@email.com', '+256774567890', $2, true, 'active')
      RETURNING id
    `, [roleMap['ATTENDANT'], passwordHash]);
    const attendantId1 = attendantUser1.rows[0].id;

    const attendantUser2 = await client.query(`
      INSERT INTO users (role_id, name, email, phone, password_hash, is_verified, status)
      VALUES ($1, 'Alice Nakibuuka', 'alice.n@email.com', '+256706123456', $2, true, 'active')
      RETURNING id
    `, [roleMap['ATTENDANT'], passwordHash]);
    const attendantId2 = attendantUser2.rows[0].id;

    // Admin
    await client.query(`
      INSERT INTO users (role_id, name, email, phone, password_hash, is_verified, status)
      VALUES ($1, 'System Administrator', 'admin@email.com', '+256789456789', $2, true, 'active')
    `, [roleMap['ADMIN'], passwordHash]);

    logger.info('Seeded user accounts.');

    // 4. Seed Vehicles
    const vehicle1 = await client.query(`
      INSERT INTO vehicles (driver_id, plate, make, model, color, year, type)
      VALUES ($1, 'UAB 456H', 'Toyota', 'Corolla', 'Silver', 2019, 'sedan')
      RETURNING id
    `, [driverId]);
    const v1Id = vehicle1.rows[0].id;

    const vehicle2 = await client.query(`
      INSERT INTO vehicles (driver_id, plate, make, model, color, year, type)
      VALUES ($1, 'UAA 123K', 'Honda', 'CR-V', 'Black', 2022, 'suv')
      RETURNING id
    `, [driverId]);
    const v2Id = vehicle2.rows[0].id;

    logger.info('Seeded driver vehicles.');

    // 5. Seed Facilities
    const facilitiesData = [
      {
        name: 'Garden City Parking',
        address: 'Yusuf Lule Rd, Kampala',
        lat: 0.3192,
        lng: 32.5891,
        spaces: 120,
        rate: 2000,
        type: 'covered',
        hours: '6:00 AM – 10:00 PM',
        security: true,
        image: 'https://images.unsplash.com/photo-1548343361-02248be15911?w=800&h=400&fit=crop&auto=format',
        amenities: ['Covered', '24/7 Security', 'CCTV', 'Disabled Access', 'EV Charging']
      },
      {
        name: 'Workers House Parking',
        address: 'Pilkington Rd, Kampala CBD',
        lat: 0.3149,
        lng: 32.5814,
        spaces: 150,
        rate: 2500,
        type: 'multi-story',
        hours: '7:00 AM – 9:00 PM',
        security: true,
        image: 'https://images.unsplash.com/photo-1619335680796-54f13b88c6ba?w=800&h=400&fit=crop&auto=format',
        amenities: ['Multi-Story', 'Security Guard', 'CCTV', 'Covered Floors 2–5']
      },
      {
        name: 'Metroplex Shopping Mall',
        address: 'Naalya, Kampala',
        lat: 0.3421,
        lng: 32.6180,
        spaces: 80,
        rate: 1500,
        type: 'open',
        hours: '8:00 AM – 9:00 PM',
        security: true,
        image: 'https://images.unsplash.com/photo-1543465077-db45d34b88a5?w=800&h=400&fit=crop&auto=format',
        amenities: ['Open Air', 'Security Guard', 'Free with Purchase']
      },
      {
        name: 'Oasis Mall Parking',
        address: 'Yusuf Lule Rd, Kampala',
        lat: 0.3210,
        lng: 32.5850,
        spaces: 200,
        rate: 2000,
        type: 'covered',
        hours: '7:00 AM – 10:00 PM',
        security: true,
        image: 'https://images.unsplash.com/photo-1724274876097-103bb600debb?w=800&h=400&fit=crop&auto=format',
        amenities: ['Covered', 'CCTV', '24/7 Security', 'Valet Option', 'Disabled Access']
      },
      {
        name: 'Ntinda Complex Parking',
        address: 'Ntinda Rd, Kampala',
        lat: 0.3418,
        lng: 32.6110,
        spaces: 60,
        rate: 1000,
        type: 'open',
        hours: '6:00 AM – 8:00 PM',
        security: false,
        image: 'https://images.unsplash.com/photo-1578859695220-856a4f5edd39?w=800&h=400&fit=crop&auto=format',
        amenities: ['Open Air', 'Affordable']
      },
      {
        name: 'Pioneer Mall Parking',
        address: 'Upper Kololo, Kampala',
        lat: 0.3290,
        lng: 32.5780,
        spaces: 90,
        rate: 1500,
        type: 'covered',
        hours: '7:00 AM – 9:00 PM',
        security: true,
        image: 'https://images.unsplash.com/photo-1604063155785-ee4488b8ad15?w=800&h=400&fit=crop&auto=format',
        amenities: ['Covered', 'Security Guard', 'CCTV']
      }
    ];

    const facilityIds: string[] = [];
    for (const f of facilitiesData) {
      const res = await client.query(`
        INSERT INTO parking_facilities (
          operator_id, name, address, latitude, longitude, total_spaces, 
          available_spaces, price_per_hour, type, hours, has_security, image_url, amenities, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active')
        RETURNING id
      `, [
        operatorId, f.name, f.address, f.lat, f.lng, f.spaces, 
        f.spaces - 10, f.rate, f.type, f.hours, f.security, f.image, f.amenities
      ]);
      facilityIds.push(res.rows[0].id);
    }

    logger.info('Seeded parking facilities.');

    // 6. Set Attendant facility profiles
    await client.query(`
      INSERT INTO attendant_profiles (user_id, facility_id, shift_info)
      VALUES ($1, $2, '7:00 AM – 3:00 PM')
    `, [attendantId1, facilityIds[0]]); // Robert at Garden City

    await client.query(`
      INSERT INTO attendant_profiles (user_id, facility_id, shift_info)
      VALUES ($1, $2, '7:00 AM – 3:00 PM')
    `, [attendantId2, facilityIds[1]]); // Alice at Workers House

    // 7. Seed Zones & Spaces (For Garden City & Workers House)
    const zones = ['Zone A', 'Zone B', 'Zone C'];
    for (const facId of facilityIds.slice(0, 2)) {
      for (const zName of zones) {
        const zoneRes = await client.query(`
          INSERT INTO parking_zones (facility_id, name)
          VALUES ($1, $2) RETURNING id
        `, [facId, zName]);
        const zoneId = zoneRes.rows[0].id;

        // Seed 10 spaces per zone
        for (let i = 1; i <= 10; i++) {
          const spaceNo = `${zName.split(' ')[1]}-${String(i).padStart(2, '0')}`;
          await client.query(`
            INSERT INTO parking_spaces (zone_id, space_number, status, type)
            VALUES ($1, $2, 'available', 'standard')
          `, [zoneId, spaceNo]);
        }
      }
    }

    // 8. Seed Pricing Rules (Special rates)
    await client.query(`
      INSERT INTO pricing_rules (facility_id, rule_name, rule_type, rule_value, status)
      VALUES 
        ($1, 'Weekend Rate', 'multiplier', 0.85, 'active'),
        ($1, 'Monthly Pass', 'multiplier', 0.70, 'active'),
        ($1, 'Early Bird', 'multiplier', 0.80, 'inactive')
    `, [facilityIds[0]]);

    // 9. Seed some mock upcoming/completed reservations and sessions
    // Active session
    const activeSpaceRes = await client.query(`
      SELECT s.id, z.facility_id FROM parking_spaces s
      JOIN parking_zones z ON s.zone_id = z.id
      WHERE z.facility_id = $1 AND s.space_number = 'B-14'
      LIMIT 1
    `, [facilityIds[0]]);
    
    if (activeSpaceRes.rows.length > 0) {
      const spaceId = activeSpaceRes.rows[0].id;
      
      // Update space to occupied
      await client.query(`
        UPDATE parking_spaces SET status = 'occupied' WHERE id = $1
      `, [spaceId]);

      // Insert Active Reservation
      const resCode = 'RES-20240601-001';
      const activeRes = await client.query(`
        INSERT INTO reservations (
          code, driver_id, facility_id, vehicle_id, space_id, 
          arrival_time, duration_hours, amount, status, qr_code_token
        ) VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '47 minutes', 2, 4000, 'active', $6)
        RETURNING id
      `, [
        resCode, driverId, facilityIds[0], v1Id, spaceId, resCode
      ]);
      const resId = activeRes.rows[0].id;

      // Insert Active Session
      await client.query(`
        INSERT INTO parking_sessions (
          reservation_id, facility_id, vehicle_plate, space_id, checkin_time, status
        ) VALUES ($1, $2, 'UAB 456H', $3, NOW() - INTERVAL '47 minutes', 'active')
      `, [resId, facilityIds[0], spaceId]);
    }

    // Upcoming reservation
    const upcomingSpaceRes = await client.query(`
      SELECT s.id FROM parking_spaces s
      JOIN parking_zones z ON s.zone_id = z.id
      WHERE z.facility_id = $1 AND s.space_number = 'A-03'
      LIMIT 1
    `, [facilityIds[1]]);
    
    if (upcomingSpaceRes.rows.length > 0) {
      const spaceId = upcomingSpaceRes.rows[0].id;
      
      await client.query(`
        UPDATE parking_spaces SET status = 'reserved' WHERE id = $1
      `, [spaceId]);

      const resCode2 = 'RES-20240603-005';
      await client.query(`
        INSERT INTO reservations (
          code, driver_id, facility_id, vehicle_id, space_id, 
          arrival_time, duration_hours, amount, status, qr_code_token
        ) VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '1 day', 2, 3000, 'upcoming', $6)
      `, [
        resCode2, driverId, facilityIds[5], v2Id, spaceId, resCode2
      ]);
    }

    // 10. Seed Notifications
    await client.query(`
      INSERT INTO notifications (user_id, type, title, body, is_read)
      VALUES 
        ($1, 'confirm', 'Reservation Confirmed', 'Your parking at Garden City (Zone B-14) on Jun 1 at 10:30 AM is confirmed.', false),
        ($1, 'reminder', 'Parking Session Reminder', 'Your reserved session at Garden City starts in 30 minutes.', false),
        ($1, 'payment', 'Payment Received', 'UGX 6,000 payment for Oasis Mall Parking confirmed via MTN MoMo.', true),
        ($1, 'facility', 'Garden City is Getting Full', 'Garden City Parking is now 85% full. Reserve now to secure your space.', true)
    `, [driverId]);

    // 11. Seed Reviews
    await client.query(`
      INSERT INTO reviews (user_id, facility_id, rating, comment)
      VALUES 
        ($1, $2, 4.5, 'Very clean and secure. Staff were helpful. Will use again!'),
        ($1, $2, 4.0, 'Good location, reasonable prices. Parking was easy to find.')
    `, [driverId, facilityIds[0]]);

    // Update facility ratings & review counts
    await client.query(`
      UPDATE parking_facilities SET rating = 4.3, review_count = 2 WHERE id = $1
    `, [facilityIds[0]]);

    await client.query('COMMIT');
    logger.info('Database seeded successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    client.release();
  }
};

// Run if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      logger.info('Seeding process finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Seeding execution failed:', err);
      process.exit(1);
    });
}
