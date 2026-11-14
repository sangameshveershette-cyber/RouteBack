import mongoose, { Schema } from 'mongoose';

const LatLngSchema = new Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    role: { type: String, enum: ['customer', 'driver', 'owner'], required: true },
    fullName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    address: { type: String, required: true },
    profilePhoto: { type: String, default: '' },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'users' }
);

const driverSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    licenceNumber: { type: String, required: true },
    experienceYears: { type: Number, required: true, min: 0 },
    address: { type: String, required: true },
    profilePhoto: { type: String, default: '' },
    assignedVehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: 'VehicleOwner', default: null },
    ratingAvg: { type: Number, default: 4.7 },
    ratingCount: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'drivers' }
);

const customerSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    address: { type: String, required: true },
    totalSpent: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'customers' }
);

const vehicleOwnerSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    ownerName: { type: String, required: true },
    businessName: { type: String, default: '' },
    address: { type: String, required: true },
    totalEarnings: { type: Number, default: 0 },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'vehicleOwners' }
);

const vehicleSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'VehicleOwner', required: true },
    registrationNumber: { type: String, required: true, unique: true, uppercase: true },
    vehicleType: { type: String, required: true },
    capacityKg: { type: Number, required: true, min: 100 },
    modelName: { type: String, required: true },
    photos: { type: [String], default: [] },
    rcDocument: { type: String, default: '' },
    insuranceDocument: { type: String, default: '' },
    status: { type: String, enum: ['available', 'occupied', 'maintenance'], default: 'available' },
    assignedDriverId: { type: Schema.Types.ObjectId, ref: 'Driver', default: null },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'vehicles' }
);

const driverAssignmentSchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'VehicleOwner', required: true },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    assignedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'driverAssignments' }
);

const returnTripSchema = new Schema(
  {
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'VehicleOwner', default: null },
    currentLocation: { type: String, required: true },
    returnDestination: { type: String, required: true },
    currentCoords: { type: LatLngSchema, required: true },
    destinationCoords: { type: LatLngSchema, required: true },
    departureDate: { type: String, required: true },
    departureTime: { type: String, required: true },
    availableCapacityKg: { type: Number, required: true, min: 1 },
    vehicleType: { type: String, required: true },
    expectedPrice: { type: Number, required: true, min: 0 },
    distanceKm: { type: Number, required: true },
    estimatedDurationMin: { type: Number, required: true },
    status: {
      type: String,
      enum: ['open', 'booked', 'in_progress', 'completed', 'cancelled'],
      default: 'open',
    },
    ownerApproved: { type: Boolean, default: true },
    notes: { type: String, default: '' },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'returnTrips' }
);

const shipmentRequestSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    pickupLocation: { type: String, required: true },
    deliveryLocation: { type: String, required: true },
    pickupCoords: { type: LatLngSchema, required: true },
    deliveryCoords: { type: LatLngSchema, required: true },
    pickupDate: { type: String, required: true },
    goodsCategory: { type: String, required: true },
    weightKg: { type: Number, required: true, min: 1 },
    dimensions: { type: String, default: '' },
    preferredVehicleType: { type: String, default: 'Any Suitable Vehicle' },
    estimatedDistanceKm: { type: Number, required: true },
    status: {
      type: String,
      enum: ['open', 'matched', 'booked', 'completed', 'cancelled'],
      default: 'open',
    },
    notes: { type: String, default: '' },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'shipmentRequests' }
);

const matchSchema = new Schema(
  {
    shipmentId: { type: Schema.Types.ObjectId, ref: 'ShipmentRequest', required: true },
    returnTripId: { type: Schema.Types.ObjectId, ref: 'ReturnTrip', required: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    score: { type: Number, required: true },
    routeScore: { type: Number, required: true },
    capacityScore: { type: Number, required: true },
    timeScore: { type: Number, required: true },
    distanceScore: { type: Number, required: true },
    estimatedFare: { type: Number, required: true },
    detourKm: { type: Number, required: true },
    explanation: { type: String, required: true },
    calculationMethod: {
      type: String,
      enum: ['demo_corridor_estimate', 'google_routes_api'],
      default: 'demo_corridor_estimate',
    },
  },
  { timestamps: true, collection: 'matches' }
);

const bookingSchema = new Schema(
  {
    bookingCode: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'VehicleOwner', default: null },
    returnTripId: { type: Schema.Types.ObjectId, ref: 'ReturnTrip', required: true },
    shipmentId: { type: Schema.Types.ObjectId, ref: 'ShipmentRequest', default: null },
    pickupLocation: { type: String, required: true },
    deliveryLocation: { type: String, required: true },
    pickupCoords: { type: LatLngSchema, required: true },
    deliveryCoords: { type: LatLngSchema, required: true },
    pickupDate: { type: String, required: true },
    goodsCategory: { type: String, required: true },
    weightKg: { type: Number, required: true },
    dimensions: { type: String, default: '' },
    agreedFare: { type: Number, required: true },
    driverRequestedFare: { type: Number, required: true },
    distanceKm: { type: Number, required: true },
    detourKm: { type: Number, default: 0 },
    matchScore: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        'Pending',
        'Accepted',
        'Rejected',
        'Confirmed',
        'Pickup Scheduled',
        'Picked Up',
        'In Transit',
        'Delivered',
        'Cancelled',
      ],
      default: 'Pending',
    },
    driverAccepted: { type: Boolean, default: false },
    ownerApproved: { type: Boolean, default: true },
    rejectionReason: { type: String, default: '' },
    cancelledBy: { type: String, enum: ['customer', 'driver', 'owner', null], default: null },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'bookings' }
);

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['booking', 'trip', 'vehicle', 'system', 'review'], default: 'system' },
    relatedId: { type: String, default: '' },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'notifications' }
);

const reviewSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
  },
  { timestamps: true, collection: 'reviews' }
);

const paymentSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'VehicleOwner', default: null },
    amount: { type: Number, required: true },
    driverShare: { type: Number, required: true },
    ownerShare: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'settled', 'refunded'], default: 'pending' },
  },
  { timestamps: true, collection: 'payments' }
);

const tripTrackingSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    currentStatus: { type: String, required: true },
    currentLocationName: { type: String, required: true },
    currentCoords: { type: LatLngSchema, required: true },
    progressPercent: { type: Number, default: 0 },
    etaMinutes: { type: Number, default: 0 },
    isSimulated: { type: Boolean, default: true },
    history: [
      {
        status: { type: String, required: true },
        locationName: { type: String, required: true },
        coords: { type: LatLngSchema, required: true },
        timestamp: { type: String, required: true },
        note: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true, collection: 'tripTracking' }
);

export const MongooseModels = {
  users: mongoose.models.User || mongoose.model('User', userSchema),
  drivers: mongoose.models.Driver || mongoose.model('Driver', driverSchema),
  customers: mongoose.models.Customer || mongoose.model('Customer', customerSchema),
  vehicleOwners: mongoose.models.VehicleOwner || mongoose.model('VehicleOwner', vehicleOwnerSchema),
  vehicles: mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema),
  driverAssignments:
    mongoose.models.DriverAssignment || mongoose.model('DriverAssignment', driverAssignmentSchema),
  returnTrips: mongoose.models.ReturnTrip || mongoose.model('ReturnTrip', returnTripSchema),
  shipmentRequests:
    mongoose.models.ShipmentRequest || mongoose.model('ShipmentRequest', shipmentRequestSchema),
  matches: mongoose.models.Match || mongoose.model('Match', matchSchema),
  bookings: mongoose.models.Booking || mongoose.model('Booking', bookingSchema),
  notifications: mongoose.models.Notification || mongoose.model('Notification', notificationSchema),
  reviews: mongoose.models.Review || mongoose.model('Review', reviewSchema),
  payments: mongoose.models.Payment || mongoose.model('Payment', paymentSchema),
  tripTracking: mongoose.models.TripTracking || mongoose.model('TripTracking', tripTrackingSchema),
} as const;
