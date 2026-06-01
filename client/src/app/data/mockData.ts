export interface ParkingFacility {
  id: string;
  name: string;
  address: string;
  totalSpaces: number;
  availableSpaces: number;
  pricePerHour: number;
  rating: number;
  reviewCount: number;
  distanceKm: number;
  etaMin: number;
  type: 'covered' | 'open' | 'multi-story';
  hasSecurity: boolean;
  openNow: boolean;
  hours: string;
  image: string;
  amenities: string[];
  lat: number;
  lng: number;
}

export interface Vehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  color: string;
  year: number;
  type: 'sedan' | 'suv' | 'truck' | 'motorcycle';
}

export interface Reservation {
  id: string;
  facilityId: string;
  facilityName: string;
  vehiclePlate: string;
  date: string;
  arrivalTime: string;
  duration: number;
  amount: number;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  qrCode: string;
  zone: string;
  spaceNumber: string;
}

export interface AppNotification {
  id: string;
  type: 'confirm' | 'reminder' | 'checkin' | 'checkout' | 'payment' | 'facility' | 'system';
  title: string;
  body: string;
  time: string;
  read: boolean;
}

export const PARKING_FACILITIES: ParkingFacility[] = [
  {
    id: 'p1',
    name: 'Garden City Parking',
    address: 'Yusuf Lule Rd, Kampala',
    totalSpaces: 120,
    availableSpaces: 34,
    pricePerHour: 2000,
    rating: 4.5,
    reviewCount: 128,
    distanceKm: 0.3,
    etaMin: 4,
    type: 'covered',
    hasSecurity: true,
    openNow: true,
    hours: '6:00 AM – 10:00 PM',
    image: 'https://images.unsplash.com/photo-1548343361-02248be15911?w=800&h=400&fit=crop&auto=format',
    amenities: ['Covered', '24/7 Security', 'CCTV', 'Disabled Access', 'EV Charging'],
    lat: 0.3192,
    lng: 32.5891,
  },
  {
    id: 'p2',
    name: 'Workers House Parking',
    address: 'Pilkington Rd, Kampala CBD',
    totalSpaces: 150,
    availableSpaces: 8,
    pricePerHour: 2500,
    rating: 4.1,
    reviewCount: 89,
    distanceKm: 0.7,
    etaMin: 9,
    type: 'multi-story',
    hasSecurity: true,
    openNow: true,
    hours: '7:00 AM – 9:00 PM',
    image: 'https://images.unsplash.com/photo-1619335680796-54f13b88c6ba?w=800&h=400&fit=crop&auto=format',
    amenities: ['Multi-Story', 'Security Guard', 'CCTV', 'Covered Floors 2–5'],
    lat: 0.3149,
    lng: 32.5814,
  },
  {
    id: 'p3',
    name: 'Metroplex Shopping Mall',
    address: 'Naalya, Kampala',
    totalSpaces: 80,
    availableSpaces: 0,
    pricePerHour: 1500,
    rating: 3.8,
    reviewCount: 214,
    distanceKm: 1.2,
    etaMin: 14,
    type: 'open',
    hasSecurity: true,
    openNow: true,
    hours: '8:00 AM – 9:00 PM',
    image: 'https://images.unsplash.com/photo-1543465077-db45d34b88a5?w=800&h=400&fit=crop&auto=format',
    amenities: ['Open Air', 'Security Guard', 'Free with Purchase'],
    lat: 0.3421,
    lng: 32.6180,
  },
  {
    id: 'p4',
    name: 'Oasis Mall Parking',
    address: 'Yusuf Lule Rd, Kampala',
    totalSpaces: 200,
    availableSpaces: 67,
    pricePerHour: 2000,
    rating: 4.6,
    reviewCount: 312,
    distanceKm: 0.9,
    etaMin: 11,
    type: 'covered',
    hasSecurity: true,
    openNow: true,
    hours: '7:00 AM – 10:00 PM',
    image: 'https://images.unsplash.com/photo-1724274876097-103bb600debb?w=800&h=400&fit=crop&auto=format',
    amenities: ['Covered', 'CCTV', '24/7 Security', 'Valet Option', 'Disabled Access'],
    lat: 0.3210,
    lng: 32.5850,
  },
  {
    id: 'p5',
    name: 'Ntinda Complex Parking',
    address: 'Ntinda Rd, Kampala',
    totalSpaces: 60,
    availableSpaces: 18,
    pricePerHour: 1000,
    rating: 3.9,
    reviewCount: 56,
    distanceKm: 2.1,
    etaMin: 19,
    type: 'open',
    hasSecurity: false,
    openNow: true,
    hours: '6:00 AM – 8:00 PM',
    image: 'https://images.unsplash.com/photo-1578859695220-856a4f5edd39?w=800&h=400&fit=crop&auto=format',
    amenities: ['Open Air', 'Affordable'],
    lat: 0.3418,
    lng: 32.6110,
  },
  {
    id: 'p6',
    name: 'Pioneer Mall Parking',
    address: 'Upper Kololo, Kampala',
    totalSpaces: 90,
    availableSpaces: 42,
    pricePerHour: 1500,
    rating: 4.3,
    reviewCount: 98,
    distanceKm: 1.6,
    etaMin: 15,
    type: 'covered',
    hasSecurity: true,
    openNow: true,
    hours: '7:00 AM – 9:00 PM',
    image: 'https://images.unsplash.com/photo-1604063155785-ee4488b8ad15?w=800&h=400&fit=crop&auto=format',
    amenities: ['Covered', 'Security Guard', 'CCTV'],
    lat: 0.3290,
    lng: 32.5780,
  },
];

export const USER_VEHICLES: Vehicle[] = [
  {
    id: 'v1',
    plate: 'UAB 456H',
    make: 'Toyota',
    model: 'Corolla',
    color: 'Silver',
    year: 2019,
    type: 'sedan',
  },
  {
    id: 'v2',
    plate: 'UAA 123K',
    make: 'Honda',
    model: 'CR-V',
    color: 'Black',
    year: 2022,
    type: 'suv',
  },
];

export const RESERVATIONS: Reservation[] = [
  {
    id: 'RES-20240601-001',
    facilityId: 'p1',
    facilityName: 'Garden City Parking',
    vehiclePlate: 'UAB 456H',
    date: '01 Jun 2024',
    arrivalTime: '10:30 AM',
    duration: 2,
    amount: 4000,
    status: 'active',
    qrCode: 'RES-20240601-001',
    zone: 'Zone B',
    spaceNumber: 'B-14',
  },
  {
    id: 'RES-20240531-002',
    facilityId: 'p4',
    facilityName: 'Oasis Mall Parking',
    vehiclePlate: 'UAB 456H',
    date: '31 May 2024',
    arrivalTime: '2:00 PM',
    duration: 3,
    amount: 6000,
    status: 'completed',
    qrCode: 'RES-20240531-002',
    zone: 'Zone A',
    spaceNumber: 'A-07',
  },
  {
    id: 'RES-20240530-003',
    facilityId: 'p2',
    facilityName: 'Workers House Parking',
    vehiclePlate: 'UAA 123K',
    date: '30 May 2024',
    arrivalTime: '9:00 AM',
    duration: 4,
    amount: 10000,
    status: 'completed',
    qrCode: 'RES-20240530-003',
    zone: 'Floor 3',
    spaceNumber: '3-21',
  },
  {
    id: 'RES-20240528-004',
    facilityId: 'p3',
    facilityName: 'Metroplex Shopping Mall',
    vehiclePlate: 'UAB 456H',
    date: '28 May 2024',
    arrivalTime: '11:30 AM',
    duration: 2,
    amount: 3000,
    status: 'cancelled',
    qrCode: 'RES-20240528-004',
    zone: 'Zone C',
    spaceNumber: 'C-02',
  },
  {
    id: 'RES-20240603-005',
    facilityId: 'p6',
    facilityName: 'Pioneer Mall Parking',
    vehiclePlate: 'UAA 123K',
    date: '03 Jun 2024',
    arrivalTime: '3:00 PM',
    duration: 2,
    amount: 3000,
    status: 'upcoming',
    qrCode: 'RES-20240603-005',
    zone: 'Zone A',
    spaceNumber: 'A-18',
  },
];

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    type: 'confirm',
    title: 'Reservation Confirmed',
    body: 'Your parking at Garden City (Zone B-14) on Jun 1 at 10:30 AM is confirmed.',
    time: '2h ago',
    read: false,
  },
  {
    id: 'n2',
    type: 'reminder',
    title: 'Parking Session Reminder',
    body: 'Your reserved session at Garden City starts in 30 minutes.',
    time: '3h ago',
    read: false,
  },
  {
    id: 'n3',
    type: 'payment',
    title: 'Payment Received',
    body: 'UGX 6,000 payment for Oasis Mall Parking confirmed via MTN MoMo.',
    time: 'Yesterday',
    read: true,
  },
  {
    id: 'n4',
    type: 'facility',
    title: 'Garden City is Getting Full',
    body: 'Garden City Parking is now 85% full. Reserve now to secure your space.',
    time: 'Yesterday',
    read: true,
  },
  {
    id: 'n5',
    type: 'checkout',
    title: 'Checkout Successful',
    body: 'You checked out of Workers House Parking. Session duration: 3h 42m.',
    time: '2 days ago',
    read: true,
  },
  {
    id: 'n6',
    type: 'system',
    title: 'New Parking Facility Added',
    body: 'Crystal Centre Parking on Kira Rd is now available on Parka.',
    time: '3 days ago',
    read: true,
  },
];

export const formatUGX = (amount: any) => {
  if (amount === undefined || amount === null) return 'UGX 0';
  const parsed = Number(amount);
  if (isNaN(parsed)) return 'UGX 0';
  return `UGX ${parsed.toLocaleString()}`;
};

export function getAvailabilityStatus(facility: ParkingFacility) {
  const pct = facility.availableSpaces / facility.totalSpaces;
  if (facility.availableSpaces === 0) return { label: 'Full', color: '#DC2626', bg: '#FEF2F2', dot: '#DC2626' };
  if (pct < 0.2) return { label: 'Limited', color: '#F59E0B', bg: '#FFFBEB', dot: '#F59E0B' };
  return { label: 'Available', color: '#16A34A', bg: '#F0FDF4', dot: '#16A34A' };
}
