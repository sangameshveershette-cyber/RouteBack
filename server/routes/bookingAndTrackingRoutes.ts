import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { db } from '../db/adapter.ts';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.ts';
import { calculateEnvironmentalImpact } from '../services/envService.ts';
import {
  estimateRoadDistanceKm,
  interpolateCoords,
  resolveLocationCoords,
} from '../services/geoService.ts';
import type { BookingDoc, BookingStatus, LatLng } from '../types.ts';

export const bookingAndTrackingRouter = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '');
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WebP images and PDF documents up to 5MB are allowed.'));
    }
  },
});

bookingAndTrackingRouter.post('/uploads', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No valid file uploaded.' });
    return;
  }
  res.json({
    url: `/uploads/${req.file.filename}`,
    filename: req.file.originalname,
    size: req.file.size,
  });
});

async function hydrateBookings(bookings: BookingDoc[]) {
  const customers = await db.find('customers');
  const drivers = await db.find('drivers');
  const owners = await db.find('vehicleOwners');
  const users = await db.find('users');
  const vehicles = await db.find('vehicles');
  const trackings = await db.find('tripTracking');
  const reviews = await db.find('reviews');

  const custMap = new Map(customers.map((c) => [c._id, c]));
  const driverMap = new Map(drivers.map((d) => [d._id, d]));
  const ownerMap = new Map(owners.map((o) => [o._id, o]));
  const userMap = new Map(users.map((u) => [u._id, u]));
  const vehicleMap = new Map(vehicles.map((v) => [v._id, v]));
  const trackMap = new Map(trackings.map((t) => [t.bookingId, t]));
  const reviewMap = new Map(reviews.map((r) => [r.bookingId, r]));

  return bookings.map((b) => {
    const cust = custMap.get(b.customerId);
    const custUser = cust ? userMap.get(cust.userId) : null;
    const drv = driverMap.get(b.driverId);
    const drvUser = drv ? userMap.get(drv.userId) : null;
    const own = b.ownerId ? ownerMap.get(b.ownerId) : null;
    const veh = vehicleMap.get(b.vehicleId);
    const tracking = trackMap.get(b._id) || null;
    const review = reviewMap.get(b._id) || null;

    const showContactDetails = [
      'Accepted',
      'Confirmed',
      'Pickup Scheduled',
      'Picked Up',
      'In Transit',
      'Delivered',
    ].includes(b.status);

    return {
      ...b,
      customer: custUser
        ? {
            _id: cust!._id,
            fullName: custUser.fullName,
            mobile: showContactDetails ? custUser.mobile : 'Shared after acceptance',
            email: showContactDetails ? custUser.email : undefined,
            address: cust!.address,
          }
        : null,
      driver: drv && drvUser
        ? {
            _id: drv._id,
            fullName: drvUser.fullName,
            mobile: showContactDetails ? drvUser.mobile : 'Shared after confirmation',
            licenceNumber: drv.licenceNumber,
            experienceYears: drv.experienceYears,
            ratingAvg: drv.ratingAvg,
          }
        : null,
      vehicle: veh
        ? {
            _id: veh._id,
            registrationNumber: veh.registrationNumber,
            vehicleType: veh.vehicleType,
            modelName: veh.modelName,
            capacityKg: veh.capacityKg,
            photos: veh.photos,
          }
        : null,
      ownerName: own?.businessName || own?.ownerName || '',
      tracking,
      review,
    };
  });
}

bookingAndTrackingRouter.get('/bookings', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { role, userId } = req.auth!;
    let list: BookingDoc[] = [];

    if (role === 'customer') {
      const cust = await db.findOne('customers', { userId });
      if (!cust) {
        res.status(404).json({ error: 'Customer profile not found.' });
        return;
      }
      list = await db.find(
        'bookings',
        { customerId: cust._id },
        { sortBy: 'createdAt', sortDir: 'desc' }
      );
    } else if (role === 'driver') {
      const drv = await db.findOne('drivers', { userId });
      if (!drv) {
        res.status(404).json({ error: 'Driver profile not found.' });
        return;
      }
      list = await db.find(
        'bookings',
        { driverId: drv._id },
        { sortBy: 'createdAt', sortDir: 'desc' }
      );
    } else if (role === 'owner') {
      const own = await db.findOne('vehicleOwners', { userId });
      if (!own) {
        res.status(404).json({ error: 'Owner profile not found.' });
        return;
      }
      list = await db.find(
        'bookings',
        { ownerId: own._id },
        { sortBy: 'createdAt', sortDir: 'desc' }
      );
    }

    res.json({ bookings: await hydrateBookings(list) });
  } catch (err) {
    console.error('[Bookings GET Error]', err);
    res.status(500).json({ error: 'Failed to load bookings.' });
  }
});

bookingAndTrackingRouter.post(
  '/bookings',
  requireAuth,
  requireRole('customer'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const customer = await db.findOne('customers', { userId: req.auth!.userId });
      if (!customer) {
        res.status(404).json({ error: 'Customer profile not found.' });
        return;
      }

      const {
        returnTripId,
        shipmentId,
        pickupLocation,
        deliveryLocation,
        pickupCoords,
        deliveryCoords,
        pickupDate,
        goodsCategory,
        weightKg,
        dimensions,
        agreedFare,
        detourKm,
        matchScore,
      } = req.body as Record<string, unknown>;

      const trip = await db.findById('returnTrips', String(returnTripId || ''));
      if (!trip) {
        res.status(404).json({ error: 'Selected return trip not found.' });
        return;
      }
      if (trip.status !== 'open') {
        res.status(409).json({
          error: 'This return trip is already booked or unavailable.',
        });
        return;
      }

      const weight = Number(weightKg);
      if (!Number.isFinite(weight) || weight <= 0) {
        res.status(400).json({ error: 'Valid shipment weight in kg is required.' });
        return;
      }
      if (weight > trip.availableCapacityKg) {
        res.status(400).json({
          error: `Shipment weight (${weight} kg) exceeds available vehicle capacity (${trip.availableCapacityKg} kg).`,
        });
        return;
      }

      // Prevent duplicate/overlapping booking on same vehicle & date
      const overlapping = await db.find('bookings', {
        vehicleId: trip.vehicleId,
        pickupDate: String(pickupDate || trip.departureDate),
        status: {
          $in: ['Pending', 'Accepted', 'Confirmed', 'Pickup Scheduled', 'Picked Up', 'In Transit'],
        },
      });
      const sameTripPending = overlapping.find((b) => b.returnTripId === trip._id && b.customerId === customer._id);
      if (sameTripPending) {
        res.status(409).json({
          error: `You already have an active booking (${sameTripPending.bookingCode}) for this return trip.`,
        });
        return;
      }
      const confirmedOverlap = overlapping.find((b) =>
        ['Confirmed', 'Pickup Scheduled', 'Picked Up', 'In Transit'].includes(b.status)
      );
      if (confirmedOverlap) {
        res.status(409).json({
          error: 'This vehicle already has a confirmed overlapping schedule on that date.',
        });
        return;
      }

      const cleanPickup = String(pickupLocation || trip.currentLocation).trim();
      const cleanDelivery = String(deliveryLocation || trip.returnDestination).trim();
      const pCoords = resolveLocationCoords(cleanPickup, pickupCoords as LatLng | undefined);
      const dCoords = resolveLocationCoords(cleanDelivery, deliveryCoords as LatLng | undefined);
      const distanceKm = estimateRoadDistanceKm(pCoords, dCoords);
      const finalFare = Number(agreedFare) > 0 ? Math.round(Number(agreedFare)) : trip.expectedPrice;

      const bookingCode = `RB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const created = await db.insertOne('bookings', {
        bookingCode,
        customerId: customer._id,
        driverId: trip.driverId,
        vehicleId: trip.vehicleId,
        ownerId: trip.ownerId ?? null,
        returnTripId: trip._id,
        shipmentId: shipmentId ? String(shipmentId) : null,
        pickupLocation: cleanPickup,
        deliveryLocation: cleanDelivery,
        pickupCoords: pCoords,
        deliveryCoords: dCoords,
        pickupDate: String(pickupDate || trip.departureDate),
        goodsCategory: String(goodsCategory || 'Commercial Goods'),
        weightKg: weight,
        dimensions: String(dimensions || ''),
        agreedFare: finalFare,
        driverRequestedFare: trip.expectedPrice,
        distanceKm,
        detourKm: Number(detourKm) || 0,
        matchScore: Number(matchScore) || 88,
        status: 'Pending',
        driverAccepted: false,
        ownerApproved: true,
        rejectionReason: '',
        cancelledBy: null,
        isDemo: false,
      });

      await db.insertOne('tripTracking', {
        bookingId: created._id,
        currentStatus: 'Pending',
        currentLocationName: cleanPickup,
        currentCoords: pCoords,
        progressPercent: 0,
        etaMinutes: trip.estimatedDurationMin,
        isSimulated: true,
        history: [
          {
            status: 'Pending',
            locationName: cleanPickup,
            coords: pCoords,
            timestamp: new Date().toISOString(),
            note: `Booking ${bookingCode} submitted. Awaiting driver confirmation.`,
          },
        ],
      });

      if (shipmentId) {
        await db.updateById('shipmentRequests', String(shipmentId), { status: 'booked' });
      }

      // Notify driver & owner
      const driver = await db.findById('drivers', trip.driverId);
      if (driver) {
        await db.insertOne('notifications', {
          userId: driver.userId,
          title: `New Booking Request ${bookingCode}`,
          message: `${req.auth!.fullName} requested ${cleanPickup} → ${cleanDelivery} (${weight} kg · ₹${finalFare}).`,
          type: 'booking',
          relatedId: created._id,
          isRead: false,
        });
      }
      if (trip.ownerId) {
        const owner = await db.findById('vehicleOwners', trip.ownerId);
        if (owner) {
          await db.insertOne('notifications', {
            userId: owner.userId,
            title: `Fleet Booking Request ${bookingCode}`,
            message: `Customer ${req.auth!.fullName} requested a return-trip booking on your vehicle (${cleanPickup} → ${cleanDelivery}).`,
            type: 'booking',
            relatedId: created._id,
            isRead: false,
          });
        }
      }

      const [hydrated] = await hydrateBookings([created]);
      res.status(201).json({ booking: hydrated });
    } catch (err) {
      console.error('[Booking POST Error]', err);
      res.status(500).json({ error: 'Failed to create booking.' });
    }
  }
);

bookingAndTrackingRouter.post(
  '/bookings/:id/accept',
  requireAuth,
  requireRole('driver', 'owner'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const booking = await db.findById('bookings', req.params.id);
      if (!booking) {
        res.status(404).json({ error: 'Booking not found.' });
        return;
      }

      const { role, userId } = req.auth!;
      if (role === 'driver') {
        const drv = await db.findOne('drivers', { userId });
        if (!drv || booking.driverId !== drv._id) {
          res.status(403).json({ error: 'You are not assigned to this booking.' });
          return;
        }
      } else {
        const own = await db.findOne('vehicleOwners', { userId });
        if (!own || booking.ownerId !== own._id) {
          res.status(403).json({ error: 'This booking is not for your fleet.' });
          return;
        }
      }

      if (!['Pending', 'Accepted'].includes(booking.status)) {
        res.status(400).json({ error: `Cannot accept a booking in ${booking.status} state.` });
        return;
      }

      // Check for duplicate confirmed booking on the same trip
      const trip = await db.findById('returnTrips', booking.returnTripId);
      if (trip && trip.status !== 'open' && !booking.driverAccepted) {
        res.status(409).json({
          error: 'Return trip has already been booked by another shipment.',
        });
        return;
      }

      const updated = await db.updateById('bookings', booking._id, {
        driverAccepted: role === 'driver' ? true : booking.driverAccepted || true,
        ownerApproved: true,
        status: 'Confirmed',
      });

      // Mark returnTrip as booked and vehicle as occupied
      if (trip) {
        await db.updateById('returnTrips', trip._id, { status: 'booked' });
      }
      await db.updateById('vehicles', booking.vehicleId, { status: 'occupied' });

      // Increment customer totalBookings
      const cust = await db.findById('customers', booking.customerId);
      if (cust) {
        await db.updateById('customers', cust._id, {
          totalBookings: cust.totalBookings + 1,
        });
        await db.insertOne('notifications', {
          userId: cust.userId,
          title: `Booking ${booking.bookingCode} Confirmed`,
          message: `Your shipment from ${booking.pickupLocation} to ${booking.deliveryLocation} has been accepted and confirmed.`,
          type: 'booking',
          relatedId: booking._id,
          isRead: false,
        });
      }

      // Create pending payment record if not existing
      const existingPay = await db.findOne('payments', { bookingId: booking._id });
      if (!existingPay) {
        const driverShare = Math.round(booking.agreedFare * 0.72);
        const ownerShare = Math.round(booking.agreedFare * 0.23);
        const platformFee = booking.agreedFare - driverShare - ownerShare;
        await db.insertOne('payments', {
          bookingId: booking._id,
          customerId: booking.customerId,
          driverId: booking.driverId,
          ownerId: booking.ownerId ?? null,
          amount: booking.agreedFare,
          driverShare,
          ownerShare,
          platformFee,
          status: 'pending',
        });
      }

      const tracking = await db.findOne('tripTracking', { bookingId: booking._id });
      if (tracking) {
        await db.updateById('tripTracking', tracking._id, {
          currentStatus: 'Confirmed',
          progressPercent: 10,
          history: [
            ...tracking.history,
            {
              status: 'Confirmed',
              locationName: booking.pickupLocation,
              coords: booking.pickupCoords,
              timestamp: new Date().toISOString(),
              note: `Confirmed by ${role === 'driver' ? 'driver' : 'vehicle owner'}. Ready for pickup.`,
            },
          ],
        });
      }

      const [hydrated] = await hydrateBookings([updated!]);
      res.json({ booking: hydrated });
    } catch (err) {
      console.error('[Booking Accept Error]', err);
      res.status(500).json({ error: 'Failed to accept booking.' });
    }
  }
);

bookingAndTrackingRouter.post(
  '/bookings/:id/reject',
  requireAuth,
  requireRole('driver', 'owner'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const booking = await db.findById('bookings', req.params.id);
      if (!booking) {
        res.status(404).json({ error: 'Booking not found.' });
        return;
      }

      const { role, userId } = req.auth!;
      if (role === 'driver') {
        const drv = await db.findOne('drivers', { userId });
        if (!drv || booking.driverId !== drv._id) {
          res.status(403).json({ error: 'Access denied.' });
          return;
        }
      } else {
        const own = await db.findOne('vehicleOwners', { userId });
        if (!own || booking.ownerId !== own._id) {
          res.status(403).json({ error: 'Access denied.' });
          return;
        }
      }

      const reason = String((req.body as { reason?: string }).reason || 'Schedule conflict');
      const updated = await db.updateById('bookings', booking._id, {
        status: 'Rejected',
        rejectionReason: reason,
      });

      const cust = await db.findById('customers', booking.customerId);
      if (cust) {
        await db.insertOne('notifications', {
          userId: cust.userId,
          title: `Booking ${booking.bookingCode} Declined`,
          message: `Your request (${booking.pickupLocation} → ${booking.deliveryLocation}) was declined: ${reason}`,
          type: 'booking',
          relatedId: booking._id,
          isRead: false,
        });
      }

      const [hydrated] = await hydrateBookings([updated!]);
      res.json({ booking: hydrated });
    } catch (err) {
      console.error('[Booking Reject Error]', err);
      res.status(500).json({ error: 'Failed to reject booking.' });
    }
  }
);

bookingAndTrackingRouter.patch(
  '/bookings/:id/status',
  requireAuth,
  requireRole('driver', 'owner'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const booking = await db.findById('bookings', req.params.id);
      if (!booking) {
        res.status(404).json({ error: 'Booking not found.' });
        return;
      }

      const { role, userId } = req.auth!;
      if (role === 'driver') {
        const drv = await db.findOne('drivers', { userId });
        if (!drv || booking.driverId !== drv._id) {
          res.status(403).json({ error: 'Access denied.' });
          return;
        }
      } else {
        const own = await db.findOne('vehicleOwners', { userId });
        if (!own || booking.ownerId !== own._id) {
          res.status(403).json({ error: 'Access denied.' });
          return;
        }
      }

      const nextStatus = (req.body as { status?: BookingStatus }).status;
      const validProgression: BookingStatus[] = [
        'Pickup Scheduled',
        'Picked Up',
        'In Transit',
        'Delivered',
      ];
      if (!nextStatus || !validProgression.includes(nextStatus)) {
        res.status(400).json({ error: 'Invalid status transition.' });
        return;
      }

      if (booking.status === 'Delivered' || booking.status === 'Cancelled' || booking.status === 'Rejected') {
        res.status(400).json({ error: `Booking is already ${booking.status}.` });
        return;
      }

      const updated = await db.updateById('bookings', booking._id, { status: nextStatus });

      const progressMap: Record<string, number> = {
        'Pickup Scheduled': 20,
        'Picked Up': 35,
        'In Transit': 65,
        Delivered: 100,
      };
      const progress = progressMap[nextStatus] ?? 50;
      const currentCoords = interpolateCoords(
        booking.pickupCoords,
        booking.deliveryCoords,
        progress / 100
      );
      const currentLocName =
        nextStatus === 'Delivered'
          ? booking.deliveryLocation
          : nextStatus === 'In Transit'
            ? `En route (${booking.pickupLocation} → ${booking.deliveryLocation})`
            : booking.pickupLocation;

      const tracking = await db.findOne('tripTracking', { bookingId: booking._id });
      const trip = await db.findById('returnTrips', booking.returnTripId);
      const totalDur = trip?.estimatedDurationMin || 180;

      if (tracking) {
        await db.updateById('tripTracking', tracking._id, {
          currentStatus: nextStatus,
          currentLocationName: currentLocName,
          currentCoords,
          progressPercent: progress,
          etaMinutes: nextStatus === 'Delivered' ? 0 : Math.round(totalDur * (1 - progress / 100)),
          history: [
            ...tracking.history,
            {
              status: nextStatus,
              locationName: currentLocName,
              coords: currentCoords,
              timestamp: new Date().toISOString(),
              note: `Trip updated to ${nextStatus} (Simulated corridor telemetry).`,
            },
          ],
        });
      }

      if (nextStatus === 'Picked Up' || nextStatus === 'In Transit') {
        if (trip) await db.updateById('returnTrips', trip._id, { status: 'in_progress' });
      }

      if (nextStatus === 'Delivered') {
        if (trip) await db.updateById('returnTrips', trip._id, { status: 'completed' });
        await db.updateById('vehicles', booking.vehicleId, { status: 'available' });
        if (booking.shipmentId) {
          await db.updateById('shipmentRequests', booking.shipmentId, { status: 'completed' });
        }

        // Settle payment & update earnings/spend
        const pay = await db.findOne('payments', { bookingId: booking._id });
        const driverShare = pay?.driverShare ?? Math.round(booking.agreedFare * 0.72);
        const ownerShare = pay?.ownerShare ?? Math.round(booking.agreedFare * 0.23);

        if (pay && pay.status !== 'settled') {
          await db.updateById('payments', pay._id, { status: 'settled' });
        } else if (!pay) {
          await db.insertOne('payments', {
            bookingId: booking._id,
            customerId: booking.customerId,
            driverId: booking.driverId,
            ownerId: booking.ownerId ?? null,
            amount: booking.agreedFare,
            driverShare,
            ownerShare,
            platformFee: booking.agreedFare - driverShare - ownerShare,
            status: 'settled',
          });
        }

        const drv = await db.findById('drivers', booking.driverId);
        if (drv) {
          await db.updateById('drivers', drv._id, {
            totalEarnings: drv.totalEarnings + driverShare,
          });
        }
        if (booking.ownerId) {
          const own = await db.findById('vehicleOwners', booking.ownerId);
          if (own) {
            await db.updateById('vehicleOwners', own._id, {
              totalEarnings: own.totalEarnings + ownerShare,
            });
          }
        }
        const cust = await db.findById('customers', booking.customerId);
        if (cust) {
          await db.updateById('customers', cust._id, {
            totalSpent: cust.totalSpent + booking.agreedFare,
          });
        }
      }

      const cust = await db.findById('customers', booking.customerId);
      if (cust) {
        await db.insertOne('notifications', {
          userId: cust.userId,
          title: `Shipment ${booking.bookingCode}: ${nextStatus}`,
          message:
            nextStatus === 'Delivered'
              ? `Your goods were delivered at ${booking.deliveryLocation}. You can now rate your driver.`
              : `Your shipment from ${booking.pickupLocation} to ${booking.deliveryLocation} is now ${nextStatus}.`,
          type: 'booking',
          relatedId: booking._id,
          isRead: false,
        });
      }

      const [hydrated] = await hydrateBookings([updated!]);
      res.json({ booking: hydrated });
    } catch (err) {
      console.error('[Booking Status Error]', err);
      res.status(500).json({ error: 'Failed to update booking status.' });
    }
  }
);

bookingAndTrackingRouter.post(
  '/bookings/:id/cancel',
  requireAuth,
  requireRole('customer'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const cust = await db.findOne('customers', { userId: req.auth!.userId });
      const booking = await db.findById('bookings', req.params.id);
      if (!cust || !booking) {
        res.status(404).json({ error: 'Booking not found.' });
        return;
      }
      if (booking.customerId !== cust._id) {
        res.status(403).json({ error: 'Access denied.' });
        return;
      }

      const cancellable: BookingStatus[] = ['Pending', 'Accepted', 'Confirmed', 'Pickup Scheduled'];
      if (!cancellable.includes(booking.status)) {
        res.status(400).json({
          error: `Bookings in "${booking.status}" status cannot be cancelled.`,
        });
        return;
      }

      const updated = await db.updateById('bookings', booking._id, {
        status: 'Cancelled',
        cancelledBy: 'customer',
      });

      await db.updateById('returnTrips', booking.returnTripId, { status: 'open' });
      await db.updateById('vehicles', booking.vehicleId, { status: 'available' });

      const drv = await db.findById('drivers', booking.driverId);
      if (drv) {
        await db.insertOne('notifications', {
          userId: drv.userId,
          title: `Booking ${booking.bookingCode} Cancelled`,
          message: `The customer cancelled the booking for ${booking.pickupLocation} → ${booking.deliveryLocation}. Your return trip is open again.`,
          type: 'booking',
          relatedId: booking._id,
          isRead: false,
        });
      }

      const [hydrated] = await hydrateBookings([updated!]);
      res.json({ booking: hydrated });
    } catch (err) {
      console.error('[Booking Cancel Error]', err);
      res.status(500).json({ error: 'Failed to cancel booking.' });
    }
  }
);

// Shipment Tracking (lookup by booking _id or bookingCode)
bookingAndTrackingRouter.get('/tracking/:idOrCode', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const key = req.params.idOrCode;
    const booking =
      (await db.findById('bookings', key)) ||
      (await db.findOne('bookings', { bookingCode: key.toUpperCase() }));

    if (!booking) {
      res.status(404).json({ error: 'Booking not found for tracking.' });
      return;
    }

    const { role, userId } = req.auth!;
    if (role === 'customer') {
      const c = await db.findOne('customers', { userId });
      if (!c || booking.customerId !== c._id) {
        res.status(403).json({ error: 'Unauthorized tracking access.' });
        return;
      }
    } else if (role === 'driver') {
      const d = await db.findOne('drivers', { userId });
      if (!d || booking.driverId !== d._id) {
        res.status(403).json({ error: 'Unauthorized tracking access.' });
        return;
      }
    } else if (role === 'owner') {
      const o = await db.findOne('vehicleOwners', { userId });
      if (!o || booking.ownerId !== o._id) {
        res.status(403).json({ error: 'Unauthorized tracking access.' });
        return;
      }
    }

    const [hydrated] = await hydrateBookings([booking]);
    res.json({ booking: hydrated });
  } catch (err) {
    console.error('[Tracking GET Error]', err);
    res.status(500).json({ error: 'Failed to load tracking details.' });
  }
});

bookingAndTrackingRouter.post('/tracking/:id/simulate-step', requireAuth, async (req, res) => {
  try {
    const booking = await db.findById('bookings', req.params.id);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }
    const tracking = await db.findOne('tripTracking', { bookingId: booking._id });
    if (!tracking) {
      res.status(404).json({ error: 'Tracking record not found.' });
      return;
    }

    const nextProgress = Math.min(95, Math.max(tracking.progressPercent + 15, 25));
    const nextCoords = interpolateCoords(
      booking.pickupCoords,
      booking.deliveryCoords,
      nextProgress / 100
    );
    const updated = await db.updateById('tripTracking', tracking._id, {
      progressPercent: nextProgress,
      currentCoords: nextCoords,
      currentLocationName: `Simulated Highway Checkpoint (${nextProgress}% of ${booking.pickupLocation} → ${booking.deliveryLocation})`,
      etaMinutes: Math.max(10, Math.round(tracking.etaMinutes * 0.8)),
      history: [
        ...tracking.history,
        {
          status: booking.status,
          locationName: `Highway Milestone (${nextProgress}%)`,
          coords: nextCoords,
          timestamp: new Date().toISOString(),
          note: 'Simulated GPS telemetry checkpoint update (Demo mode).',
        },
      ],
    });
    res.json({ tracking: updated });
  } catch (err) {
    console.error('[Simulate GPS Error]', err);
    res.status(500).json({ error: 'Failed to simulate GPS ping.' });
  }
});

// Reviews & Driver Ratings
bookingAndTrackingRouter.post(
  '/reviews',
  requireAuth,
  requireRole('customer'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const customer = await db.findOne('customers', { userId: req.auth!.userId });
      const { bookingId, rating, comment } = req.body as {
        bookingId?: string;
        rating?: number;
        comment?: string;
      };

      const booking = await db.findById('bookings', String(bookingId || ''));
      if (!customer || !booking) {
        res.status(404).json({ error: 'Booking not found.' });
        return;
      }
      if (booking.customerId !== customer._id) {
        res.status(403).json({ error: 'Access denied.' });
        return;
      }
      if (booking.status !== 'Delivered') {
        res.status(400).json({ error: 'You can only review completed deliveries.' });
        return;
      }

      const existing = await db.findOne('reviews', { bookingId: booking._id });
      if (existing) {
        res.status(409).json({ error: 'You have already reviewed this booking.' });
        return;
      }

      const numRating = Math.max(1, Math.min(5, Number(rating) || 5));
      const review = await db.insertOne('reviews', {
        bookingId: booking._id,
        customerId: customer._id,
        driverId: booking.driverId,
        rating: numRating,
        comment: String(comment || '').trim(),
      });

      // Update driver rating average
      const driver = await db.findById('drivers', booking.driverId);
      if (driver) {
        const allReviews = await db.find('reviews', { driverId: driver._id });
        const avg =
          allReviews.reduce((acc, r) => acc + r.rating, 0) / Math.max(1, allReviews.length);
        await db.updateById('drivers', driver._id, {
          ratingAvg: Number(avg.toFixed(2)),
          ratingCount: allReviews.length,
        });

        await db.insertOne('notifications', {
          userId: driver.userId,
          title: `New ${numRating}-Star Rating Received`,
          message: `${req.auth!.fullName} rated trip ${booking.bookingCode}: "${comment || 'Great service'}"`,
          type: 'review',
          relatedId: booking._id,
          isRead: false,
        });
      }

      res.status(201).json({ review });
    } catch (err) {
      console.error('[Review POST Error]', err);
      res.status(500).json({ error: 'Failed to submit review.' });
    }
  }
);

bookingAndTrackingRouter.get('/reviews/driver/:driverId', async (req, res) => {
  try {
    const reviews = await db.find(
      'reviews',
      { driverId: req.params.driverId },
      { sortBy: 'createdAt', sortDir: 'desc' }
    );
    res.json({ reviews });
  } catch {
    res.status(500).json({ error: 'Failed to load reviews.' });
  }
});

// Notifications
bookingAndTrackingRouter.get('/notifications', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const list = await db.find(
      'notifications',
      { userId: req.auth!.userId },
      { sortBy: 'createdAt', sortDir: 'desc', limit: 30 }
    );
    res.json({ notifications: list });
  } catch {
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

bookingAndTrackingRouter.patch(
  '/notifications/:id/read',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const notif = await db.findById('notifications', req.params.id);
    if (!notif || notif.userId !== req.auth!.userId) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }
    const updated = await db.updateById('notifications', notif._id, { isRead: true });
    res.json({ notification: updated });
  }
);

bookingAndTrackingRouter.patch(
  '/notifications/read-all',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    await db.updateMany('notifications', { userId: req.auth!.userId, isRead: false }, { isRead: true });
    res.json({ ok: true });
  }
);

// Environmental Impact & Platform Stats
bookingAndTrackingRouter.get('/impact', async (req, res) => {
  try {
    const bookings = await db.find('bookings');
    const vehicles = await db.find('vehicles');
    const returnTrips = await db.find('returnTrips');
    const drivers = await db.find('drivers');
    const customers = await db.find('customers');
    const owners = await db.find('vehicleOwners');

    const co2Factor = req.query.co2Factor ? Number(req.query.co2Factor) : undefined;
    const avoidanceFactor = req.query.avoidanceFactor ? Number(req.query.avoidanceFactor) : undefined;

    const report = calculateEnvironmentalImpact(bookings, vehicles, returnTrips, {
      co2KgPerLitreDiesel: co2Factor && Number.isFinite(co2Factor) ? co2Factor : undefined,
      emptyReturnAvoidanceFactor:
        avoidanceFactor && Number.isFinite(avoidanceFactor) ? avoidanceFactor : undefined,
    });

    res.json({
      impact: report,
      platformStats: {
        totalDrivers: drivers.length,
        totalVehicleOwners: owners.length,
        totalVehicles: vehicles.length,
        totalCustomers: customers.length,
        openReturnTrips: returnTrips.filter((t) => t.status === 'open').length,
        totalBookings: bookings.length,
        dbMode: db.getMode(),
      },
    });
  } catch (err) {
    console.error('[Impact GET Error]', err);
    res.status(500).json({ error: 'Failed to compute environmental impact.' });
  }
});
