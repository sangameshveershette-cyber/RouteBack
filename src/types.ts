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

export interface LatLng {
  lat: number;
  lng: number;
}

export interface User {
  _id: string;
  role: UserRole;
  fullName: string;
  mobile: string;
  email: string;
  address: string;
  profilePhoto?: string;
}

export interface Vehicle {
  _id: string;
  ownerId: string;
  registrationNumber: string;
  vehicleType: string;
  capacityKg: number;
  modelName: string;
  photos: string[];
  rcDocument?: string;
  insuranceDocument?: string;
  status: 'available' | 'occupied' | 'maintenance';
  assignedDriverId?: string | null;
  ownerName?: string;
  businessName?: string;
  assignedDriver?: {
    _id: string;
    userId: string;
    fullName: string;
    mobile: string;
    email: string;
    licenceNumber: string;
    experienceYears: number;
    ratingAvg: number;
  } | null;
}

export interface ReturnTrip {
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
  vehicleType: string;
  expectedPrice: number;
  distanceKm: number;
  estimatedDurationMin: number;
  status: 'open' | 'booked' | 'in_progress' | 'completed' | 'cancelled';
  ownerApproved: boolean;
  notes?: string;
  driver?: {
    _id: string;
    fullName: string;
    mobile: string;
    ratingAvg: number;
    experienceYears: number;
  } | null;
  vehicle?: Vehicle | null;
  ownerName?: string;
}

export interface ShipmentRequest {
  _id: string;
  customerId: string;
  customerName?: string;
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
  createdAt: string;
}

export interface FareBreakdown {
  baseComponent: number;
  distanceComponent: number;
  weightSurcharge: number;
  detourFuelSurcharge: number;
  estimatedFuelCost: number;
  driverExpectedFare: number;
  estimatedTotalFare: number;
  dieselPricePerLitre: number;
  disclaimer: string;
}

export interface RankedMatch {
  returnTrip: ReturnTrip;
  driver: {
    _id: string;
    licenceNumber: string;
    experienceYears: number;
    ratingAvg: number;
    ratingCount: number;
  };
  driverUser: {
    _id: string;
    fullName: string;
    mobile: string;
    profilePhoto?: string;
  };
  vehicle: Vehicle;
  score: number;
  routeScore: number;
  capacityScore: number;
  timeScore: number;
  distanceScore: number;
  detourKm: number;
  shipmentDistanceKm: number;
  estimatedFare: number;
  fareBreakdown: FareBreakdown;
  explanation: string;
  calculationMethod: 'demo_corridor_estimate' | 'google_routes_api';
}

export interface TrackingHistoryItem {
  status: BookingStatus;
  locationName: string;
  coords: LatLng;
  timestamp: string;
  note: string;
}

export interface TripTracking {
  _id: string;
  bookingId: string;
  currentStatus: BookingStatus;
  currentLocationName: string;
  currentCoords: LatLng;
  progressPercent: number;
  etaMinutes: number;
  isSimulated: boolean;
  history: TrackingHistoryItem[];
}

export interface Booking {
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
  createdAt: string;
  customer?: {
    _id: string;
    fullName: string;
    mobile: string;
    email?: string;
    address: string;
  } | null;
  driver?: {
    _id: string;
    fullName: string;
    mobile: string;
    licenceNumber: string;
    experienceYears: number;
    ratingAvg: number;
  } | null;
  vehicle?: Vehicle | null;
  ownerName?: string;
  tracking?: TripTracking | null;
  review?: {
    _id: string;
    rating: number;
    comment: string;
  } | null;
}

export interface NotificationItem {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: 'booking' | 'trip' | 'vehicle' | 'system' | 'review';
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface EnvironmentalImpactReport {
  emptyKmAvoided: number;
  estimatedFuelSavedLitres: number;
  estimatedCo2AvoidedKg: number;
  estimatedCo2AvoidedTonnes: number;
  successfulReturnTrips: number;
  activeMatchedTrips: number;
  assumptions: {
    co2KgPerLitreDiesel: number;
    emptyReturnAvoidanceFactor: number;
    avgFuelEfficiencyKmPerL: number;
    disclaimer: string;
  };
  corridorBreakdown: Array<{
    corridor: string;
    trips: number;
    kmAvoided: number;
    co2AvoidedKg: number;
    fuelSavedLitres: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    kmAvoided: number;
    co2AvoidedKg: number;
    fuelSavedLitres: number;
  }>;
}

export interface PlatformStats {
  totalDrivers: number;
  totalVehicleOwners: number;
  totalVehicles: number;
  totalCustomers: number;
  openReturnTrips: number;
  totalBookings: number;
  dbMode: 'mongodb' | 'file_adapter';
}
