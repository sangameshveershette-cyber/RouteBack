export type UserRole = 'customer' | 'driver' | 'owner';

export type BookingStatus =
  | 'Pending'
  | 'Accepted'
  | 'Rejected'
  | 'Confirmed'
  | 'Pickup Scheduled'
  | 'Picked Up'
  | 'In Transit'
  | 'Delivered'
  | 'Cancelled';

export type VehicleType =
  | 'Tata Ace (Mini Truck)'
  | 'Mahindra Bolero Pickup'
  | 'Ashok Leyland Dost'
  | 'Eicher Pro 14ft'
  | 'Tata 407 (LCV)'
  | 'BharatBenz 17ft Container'
  | 'Heavy Duty 22ft Truck';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface UserDoc {
  _id: string;
  role: UserRole;
  fullName: string;
  mobile: string;
  email: string;
  passwordHash: string;
  address: string;
  profilePhoto?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DriverDoc {
  _id: string;
  userId: string;
  licenceNumber: string;
  experienceYears: number;
  address: string;
  profilePhoto?: string;
  assignedVehicleId?: string | null;
  ownerId?: string | null;
  ratingAvg: number;
  ratingCount: number;
  totalEarnings: number;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDoc {
  _id: string;
  userId: string;
  address: string;
  totalSpent: number;
  totalBookings: number;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleOwnerDoc {
  _id: string;
  userId: string;
  ownerName: string;
  businessName?: string;
  address: string;
  totalEarnings: number;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleDoc {
  _id: string;
  ownerId: string;
  registrationNumber: string;
  vehicleType: VehicleType;
  capacityKg: number;
  modelName: string;
  photos: string[];
  rcDocument?: string;
  insuranceDocument?: string;
  status: 'available' | 'occupied' | 'maintenance';
  assignedDriverId?: string | null;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DriverAssignmentDoc {
  _id: string;
  vehicleId: string;
  driverId: string;
  ownerId: string;
  status: 'active' | 'revoked';
  assignedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnTripDoc {
  _id: string;
  driverId: string;
  vehicleId: string;
  ownerId?: string | null;
  currentLocation: string;
  returnDestination: string;
  currentCoords: LatLng;
  destinationCoords: LatLng;
  departureDate: string;
  departureTime: string;
  availableCapacityKg: number;
  vehicleType: VehicleType;
  expectedPrice: number;
  distanceKm: number;
  estimatedDurationMin: number;
  status: 'open' | 'booked' | 'in_progress' | 'completed' | 'cancelled';
  ownerApproved: boolean;
  notes?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentRequestDoc {
  _id: string;
  customerId: string;
  pickupLocation: string;
  deliveryLocation: string;
  pickupCoords: LatLng;
  deliveryCoords: LatLng;
  pickupDate: string;
  goodsCategory: string;
  weightKg: number;
  dimensions?: string;
  preferredVehicleType: string;
  estimatedDistanceKm: number;
  status: 'open' | 'matched' | 'booked' | 'completed' | 'cancelled';
  notes?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MatchDoc {
  _id: string;
  shipmentId: string;
  returnTripId: string;
  driverId: string;
  vehicleId: string;
  score: number;
  routeScore: number;
  capacityScore: number;
  timeScore: number;
  distanceScore: number;
  estimatedFare: number;
  detourKm: number;
  explanation: string;
  calculationMethod: 'demo_corridor_estimate' | 'google_routes_api';
  createdAt: string;
  updatedAt: string;
}

export interface BookingDoc {
  _id: string;
  bookingCode: string;
  customerId: string;
  driverId: string;
  vehicleId: string;
  ownerId?: string | null;
  returnTripId: string;
  shipmentId?: string | null;
  pickupLocation: string;
  deliveryLocation: string;
  pickupCoords: LatLng;
  deliveryCoords: LatLng;
  pickupDate: string;
  goodsCategory: string;
  weightKg: number;
  dimensions?: string;
  agreedFare: number;
  driverRequestedFare: number;
  distanceKm: number;
  detourKm: number;
  matchScore: number;
  status: BookingStatus;
  driverAccepted: boolean;
  ownerApproved: boolean;
  rejectionReason?: string;
  cancelledBy?: UserRole | null;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDoc {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: 'booking' | 'trip' | 'vehicle' | 'system' | 'review';
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewDoc {
  _id: string;
  bookingId: string;
  customerId: string;
  driverId: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDoc {
  _id: string;
  bookingId: string;
  customerId: string;
  driverId: string;
  ownerId?: string | null;
  amount: number;
  driverShare: number;
  ownerShare: number;
  platformFee: number;
  status: 'pending' | 'settled' | 'refunded';
  createdAt: string;
  updatedAt: string;
}

export interface TrackingHistoryItem {
  status: BookingStatus;
  locationName: string;
  coords: LatLng;
  timestamp: string;
  note: string;
}

export interface TripTrackingDoc {
  _id: string;
  bookingId: string;
  currentStatus: BookingStatus;
  currentLocationName: string;
  currentCoords: LatLng;
  progressPercent: number;
  etaMinutes: number;
  isSimulated: boolean;
  history: TrackingHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CollectionSchemaMap {
  users: UserDoc;
  drivers: DriverDoc;
  customers: CustomerDoc;
  vehicleOwners: VehicleOwnerDoc;
  vehicles: VehicleDoc;
  driverAssignments: DriverAssignmentDoc;
  returnTrips: ReturnTripDoc;
  shipmentRequests: ShipmentRequestDoc;
  matches: MatchDoc;
  bookings: BookingDoc;
  notifications: NotificationDoc;
  reviews: ReviewDoc;
  payments: PaymentDoc;
  tripTracking: TripTrackingDoc;
}

export type CollectionName = keyof CollectionSchemaMap;
