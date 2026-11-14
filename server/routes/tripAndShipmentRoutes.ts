import { Router } from 'express';
import { db } from '../db/adapter.ts';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.ts';
import {
  calculateEstimatedFare,
  estimateRoadDistanceKm,
  estimateTravelDurationMin,
  resolveLocationCoords,
} from '../services/geoService.ts';
import { evaluateTripMatch, type ShipmentQuery } from '../services/matchingService.ts';
import type { LatLng, ReturnTripDoc, VehicleType } from '../types.ts';

export const tripAndShipmentRouter = Router();

async function hydrateReturnTrips(trips: ReturnTripDoc[]) {
  const drivers = await db.find('drivers');
  const users = await db.find('users');
  const vehicles = await db.find('vehicles');
  const owners = await db.find('vehicleOwners');

  const driverMap = new Map(drivers.map((d) => [d._id, d]));
  const userMap = new Map(users.map((u) => [u._id, u]));
  const vehicleMap = new Map(vehicles.map((v) => [v._id, v]));
  const ownerMap = new Map(owners.map((o) => [o._id, o]));

  return trips.map((t) => {
    const drv = driverMap.get(t.driverId);
    const drvUser = drv ? userMap.get(drv.userId) : null;
    const veh = vehicleMap.get(t.vehicleId);
    const own = t.ownerId ? ownerMap.get(t.ownerId) : null;
    return {
      ...t,
      driver: drv && drvUser
        ? {
            _id: drv._id,
            fullName: drvUser.fullName,
            mobile: drvUser.mobile,
            ratingAvg: drv.ratingAvg,
            experienceYears: drv.experienceYears,
          }
        : null,
      vehicle: veh
        ? {
            _id: veh._id,
            registrationNumber: veh.registrationNumber,
            modelName: veh.modelName,
            vehicleType: veh.vehicleType,
            capacityKg: veh.capacityKg,
            photos: veh.photos,
          }
        : null,
      ownerName: own?.businessName || own?.ownerName || '',
    };
  });
}

// List return trips (role-filtered or open public/customer browse)
tripAndShipmentRouter.get('/return-trips', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { role, userId } = req.auth!;
    const scope = String(req.query.scope || '');

    if (role === 'driver' && scope !== 'all') {
      const driver = await db.findOne('drivers', { userId });
      if (!driver) {
        res.status(404).json({ error: 'Driver profile not found.' });
        return;
      }
      const trips = await db.find(
        'returnTrips',
        { driverId: driver._id },
        { sortBy: 'createdAt', sortDir: 'desc' }
      );
      res.json({ trips: await hydrateReturnTrips(trips) });
      return;
    }

    if (role === 'owner' && scope !== 'all') {
      const owner = await db.findOne('vehicleOwners', { userId });
      if (!owner) {
        res.status(404).json({ error: 'Owner profile not found.' });
        return;
      }
      const trips = await db.find(
        'returnTrips',
        { ownerId: owner._id },
        { sortBy: 'createdAt', sortDir: 'desc' }
      );
      res.json({ trips: await hydrateReturnTrips(trips) });
      return;
    }

    // Open return trips
    const trips = await db.find(
      'returnTrips',
      { status: 'open', ownerApproved: true },
      { sortBy: 'departureDate', sortDir: 'asc' }
    );
    res.json({ trips: await hydrateReturnTrips(trips) });
  } catch (err) {
    console.error('[ReturnTrips GET Error]', err);
    res.status(500).json({ error: 'Failed to load return trips.' });
  }
});

// Driver posts a return trip ONLY using an assigned/authorized vehicle
tripAndShipmentRouter.post(
  '/return-trips',
  requireAuth,
  requireRole('driver'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const driver = await db.findOne('drivers', { userId: req.auth!.userId });
      if (!driver) {
        res.status(404).json({ error: 'Driver profile not found.' });
        return;
      }

      const {
        vehicleId,
        currentLocation,
        returnDestination,
        currentCoords,
        destinationCoords,
        departureDate,
        departureTime,
        availableCapacityKg,
        vehicleType,
        expectedPrice,
        notes,
      } = req.body as Record<string, unknown>;

      // Verify driver is authorized to operate the vehicle
      const activeAssignments = await db.find('driverAssignments', {
        driverId: driver._id,
        status: 'active',
      });
      const authorizedVehicleIds = new Set(activeAssignments.map((a) => a.vehicleId));
      if (driver.assignedVehicleId) authorizedVehicleIds.add(driver.assignedVehicleId);

      const targetVehicleId = String(vehicleId || driver.assignedVehicleId || '');
      if (!targetVehicleId || !authorizedVehicleIds.has(targetVehicleId)) {
        res.status(403).json({
          error:
            'You can only post return trips using a vehicle assigned to you by a Vehicle Owner.',
        });
        return;
      }

      const vehicle = await db.findById('vehicles', targetVehicleId);
      if (!vehicle) {
        res.status(404).json({ error: 'Assigned vehicle not found.' });
        return;
      }

      const cleanFrom = String(currentLocation || '').trim();
      const cleanTo = String(returnDestination || '').trim();
      const cleanDate = String(departureDate || '').trim();
      const cleanTime = String(departureTime || '09:00').trim();
      const cap = Number(availableCapacityKg);
      const price = Number(expectedPrice);

      if (!cleanFrom || !cleanTo || !cleanDate || !Number.isFinite(cap) || cap <= 0) {
        res.status(400).json({
          error: 'Current location, return destination, departure date, and capacity (> 0 kg) are required.',
        });
        return;
      }

      if (cap > vehicle.capacityKg) {
        res.status(400).json({
          error: `Available capacity (${cap} kg) cannot exceed vehicle maximum capacity (${vehicle.capacityKg} kg).`,
        });
        return;
      }

      // Prevent overlapping open/booked trip on same vehicle & date
      const existingSameDay = await db.find('returnTrips', {
        vehicleId: vehicle._id,
        departureDate: cleanDate,
        status: { $in: ['open', 'booked', 'in_progress'] },
      });
      if (existingSameDay.length > 0) {
        res.status(409).json({
          error: `Vehicle ${vehicle.registrationNumber} already has an active return trip scheduled on ${cleanDate}.`,
        });
        return;
      }

      const resolvedFrom = resolveLocationCoords(cleanFrom, currentCoords as LatLng | undefined);
      const resolvedTo = resolveLocationCoords(cleanTo, destinationCoords as LatLng | undefined);
      const distanceKm = estimateRoadDistanceKm(resolvedFrom, resolvedTo);
      const estimatedDurationMin = estimateTravelDurationMin(distanceKm);
      const chosenType = (vehicleType as VehicleType) || vehicle.vehicleType;
      const farePreview = calculateEstimatedFare({
        distanceKm,
        weightKg: Math.round(cap * 0.5),
        vehicleType: chosenType,
        detourKm: 0,
      });

      const created = await db.insertOne('returnTrips', {
        driverId: driver._id,
        vehicleId: vehicle._id,
        ownerId: vehicle.ownerId,
        currentLocation: cleanFrom,
        returnDestination: cleanTo,
        currentCoords: resolvedFrom,
        destinationCoords: resolvedTo,
        departureDate: cleanDate,
        departureTime: cleanTime,
        availableCapacityKg: cap,
        vehicleType: chosenType,
        expectedPrice: Number.isFinite(price) && price > 0 ? price : farePreview.estimatedTotalFare,
        distanceKm,
        estimatedDurationMin,
        status: 'open',
        ownerApproved: true,
        notes: String(notes || ''),
        isDemo: false,
      });

      if (vehicle.ownerId) {
        const owner = await db.findById('vehicleOwners', vehicle.ownerId);
        if (owner) {
          await db.insertOne('notifications', {
            userId: owner.userId,
            title: 'New Return Trip Posted',
            message: `${req.auth!.fullName} posted a ${cleanFrom} → ${cleanTo} return trip (${cap} kg) with ${vehicle.registrationNumber}.`,
            type: 'trip',
            relatedId: created._id,
            isRead: false,
          });
        }
      }

      const [hydrated] = await hydrateReturnTrips([created]);
      res.status(201).json({ trip: hydrated });
    } catch (err) {
      console.error('[ReturnTrip POST Error]', err);
      res.status(500).json({ error: 'Failed to post return trip.' });
    }
  }
);

// Owner or Driver can update return trip (including owner approval/rejection)
tripAndShipmentRouter.put('/return-trips/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const trip = await db.findById('returnTrips', req.params.id);
    if (!trip) {
      res.status(404).json({ error: 'Return trip not found.' });
      return;
    }

    const { role, userId } = req.auth!;
    if (role === 'driver') {
      const driver = await db.findOne('drivers', { userId });
      if (!driver || trip.driverId !== driver._id) {
        res.status(403).json({ error: 'You can only update your own return trips.' });
        return;
      }
    } else if (role === 'owner') {
      const owner = await db.findOne('vehicleOwners', { userId });
      if (!owner || trip.ownerId !== owner._id) {
        res.status(403).json({ error: 'You can only manage trips for your own vehicles.' });
        return;
      }
    } else {
      res.status(403).json({ error: 'Customers cannot modify return trips.' });
      return;
    }

    const { availableCapacityKg, expectedPrice, status, ownerApproved } = req.body as Record<
      string,
      unknown
    >;

    const updates: Partial<ReturnTripDoc> = {};
    if (availableCapacityKg !== undefined && Number(availableCapacityKg) > 0) {
      updates.availableCapacityKg = Number(availableCapacityKg);
    }
    if (expectedPrice !== undefined && Number(expectedPrice) >= 0) {
      updates.expectedPrice = Number(expectedPrice);
    }
    if (typeof status === 'string' && ['open', 'cancelled'].includes(status)) {
      updates.status = status as ReturnTripDoc['status'];
    }
    if (role === 'owner' && typeof ownerApproved === 'boolean') {
      updates.ownerApproved = ownerApproved;
      if (!ownerApproved) updates.status = 'cancelled';
    }

    const updated = await db.updateById('returnTrips', trip._id, updates);
    const [hydrated] = await hydrateReturnTrips([updated!]);
    res.json({ trip: hydrated });
  } catch (err) {
    console.error('[ReturnTrip PUT Error]', err);
    res.status(500).json({ error: 'Failed to update return trip.' });
  }
});

// List shipment requests (customer sees their own; driver/owner sees open requests)
tripAndShipmentRouter.get('/shipments', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { role, userId } = req.auth!;
    if (role === 'customer') {
      const customer = await db.findOne('customers', { userId });
      if (!customer) {
        res.status(404).json({ error: 'Customer profile not found.' });
        return;
      }
      const list = await db.find(
        'shipmentRequests',
        { customerId: customer._id },
        { sortBy: 'createdAt', sortDir: 'desc' }
      );
      res.json({ shipments: list });
      return;
    }

    // Drivers & Owners can inspect open shipment requests to discover load opportunities
    const openShipments = await db.find(
      'shipmentRequests',
      { status: { $in: ['open', 'matched'] } },
      { sortBy: 'pickupDate', sortDir: 'asc' }
    );
    const customers = await db.find('customers');
    const users = await db.find('users');
    const custMap = new Map(customers.map((c) => [c._id, c]));
    const userMap = new Map(users.map((u) => [u._id, u]));

    const hydrated = openShipments.map((s) => {
      const cust = custMap.get(s.customerId);
      const u = cust ? userMap.get(cust.userId) : null;
      return {
        ...s,
        customerName: u?.fullName || 'Verified Shipper',
      };
    });

    res.json({ shipments: hydrated });
  } catch (err) {
    console.error('[Shipments GET Error]', err);
    res.status(500).json({ error: 'Failed to load shipment requests.' });
  }
});

tripAndShipmentRouter.post(
  '/shipments',
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
        pickupLocation,
        deliveryLocation,
        pickupCoords,
        deliveryCoords,
        pickupDate,
        goodsCategory,
        weightKg,
        dimensions,
        preferredVehicleType,
        notes,
      } = req.body as Record<string, unknown>;

      const cleanPickup = String(pickupLocation || '').trim();
      const cleanDelivery = String(deliveryLocation || '').trim();
      const cleanDate = String(pickupDate || '').trim();
      const cleanCat = String(goodsCategory || 'General Commercial Goods').trim();
      const weight = Number(weightKg);

      if (!cleanPickup || !cleanDelivery || !cleanDate || !Number.isFinite(weight) || weight <= 0) {
        res.status(400).json({
          error: 'Pickup location, delivery location, pickup date, and weight (> 0 kg) are required.',
        });
        return;
      }

      const resolvedPickup = resolveLocationCoords(cleanPickup, pickupCoords as LatLng | undefined);
      const resolvedDelivery = resolveLocationCoords(
        cleanDelivery,
        deliveryCoords as LatLng | undefined
      );
      const estimatedDistanceKm = estimateRoadDistanceKm(resolvedPickup, resolvedDelivery);

      const created = await db.insertOne('shipmentRequests', {
        customerId: customer._id,
        pickupLocation: cleanPickup,
        deliveryLocation: cleanDelivery,
        pickupCoords: resolvedPickup,
        deliveryCoords: resolvedDelivery,
        pickupDate: cleanDate,
        goodsCategory: cleanCat,
        weightKg: weight,
        dimensions: String(dimensions || ''),
        preferredVehicleType: String(preferredVehicleType || 'Any Suitable Vehicle'),
        estimatedDistanceKm,
        status: 'open',
        notes: String(notes || ''),
        isDemo: false,
      });

      res.status(201).json({ shipment: created });
    } catch (err) {
      console.error('[Shipments POST Error]', err);
      res.status(500).json({ error: 'Failed to create shipment request.' });
    }
  }
);

tripAndShipmentRouter.put(
  '/shipments/:id',
  requireAuth,
  requireRole('customer'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const customer = await db.findOne('customers', { userId: req.auth!.userId });
      const shipment = await db.findById('shipmentRequests', req.params.id);
      if (!customer || !shipment) {
        res.status(404).json({ error: 'Shipment request not found.' });
        return;
      }
      if (shipment.customerId !== customer._id) {
        res.status(403).json({ error: 'Access denied.' });
        return;
      }
      const { status, weightKg, pickupDate, notes } = req.body as Record<string, unknown>;
      const updates: Record<string, unknown> = {};
      if (typeof status === 'string' && ['open', 'cancelled'].includes(status)) updates.status = status;
      if (weightKg !== undefined && Number(weightKg) > 0) updates.weightKg = Number(weightKg);
      if (typeof pickupDate === 'string' && pickupDate.trim()) updates.pickupDate = pickupDate.trim();
      if (typeof notes === 'string') updates.notes = notes;

      const updated = await db.updateById('shipmentRequests', shipment._id, updates);
      res.json({ shipment: updated });
    } catch (err) {
      console.error('[Shipments PUT Error]', err);
      res.status(500).json({ error: 'Failed to update shipment request.' });
    }
  }
);

// Smart Matching Engine Endpoint
tripAndShipmentRouter.post('/matching/search', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      shipmentId,
      pickupLocation,
      deliveryLocation,
      pickupCoords,
      deliveryCoords,
      pickupDate,
      weightKg,
      preferredVehicleType,
    } = req.body as Record<string, unknown>;

    let query: ShipmentQuery | null = null;
    let persistedShipmentId: string | undefined;

    if (shipmentId) {
      const sh = await db.findById('shipmentRequests', String(shipmentId));
      if (!sh) {
        res.status(404).json({ error: 'Shipment request not found.' });
        return;
      }
      persistedShipmentId = sh._id;
      query = {
        _id: sh._id,
        pickupLocation: sh.pickupLocation,
        deliveryLocation: sh.deliveryLocation,
        pickupCoords: sh.pickupCoords,
        deliveryCoords: sh.deliveryCoords,
        pickupDate: sh.pickupDate,
        weightKg: sh.weightKg,
        preferredVehicleType: sh.preferredVehicleType,
      };
    } else {
      const pLoc = String(pickupLocation || '').trim();
      const dLoc = String(deliveryLocation || '').trim();
      const pDate = String(pickupDate || '').trim();
      const wt = Number(weightKg);

      if (!pLoc || !dLoc || !pDate || !Number.isFinite(wt) || wt <= 0) {
        res.status(400).json({
          error: 'Pickup location, delivery location, pickup date, and weight (> 0 kg) are required for matching.',
        });
        return;
      }

      query = {
        pickupLocation: pLoc,
        deliveryLocation: dLoc,
        pickupCoords: resolveLocationCoords(pLoc, pickupCoords as LatLng | undefined),
        deliveryCoords: resolveLocationCoords(dLoc, deliveryCoords as LatLng | undefined),
        pickupDate: pDate,
        weightKg: wt,
        preferredVehicleType: String(preferredVehicleType || 'Any Suitable Vehicle'),
      };
    }

    const openTrips = await db.find('returnTrips', { status: 'open', ownerApproved: true });
    const drivers = await db.find('drivers');
    const users = await db.find('users');
    const vehicles = await db.find('vehicles');

    const driverMap = new Map(drivers.map((d) => [d._id, d]));
    const userMap = new Map(users.map((u) => [u._id, u]));
    const vehicleMap = new Map(vehicles.map((v) => [v._id, v]));

    const rankedMatches = [];
    const rejectedReasons: Array<{ tripId: string; route: string; reason: string }> = [];

    for (const trip of openTrips) {
      const drv = driverMap.get(trip.driverId);
      const drvUser = drv ? userMap.get(drv.userId) : undefined;
      const veh = vehicleMap.get(trip.vehicleId);
      if (!drv || !drvUser || !veh) continue;

      const evalRes = evaluateTripMatch(query, trip, drv, drvUser, veh);
      if (evalRes.suitable && evalRes.result) {
        rankedMatches.push(evalRes.result);
      } else if (evalRes.reason) {
        rejectedReasons.push({
          tripId: trip._id,
          route: `${trip.currentLocation} → ${trip.returnDestination}`,
          reason: evalRes.reason,
        });
      }
    }

    rankedMatches.sort((a, b) => b.score - a.score);

    // Persist matches if linked to a shipmentRequest
    if (persistedShipmentId) {
      await db.deleteMany('matches', { shipmentId: persistedShipmentId });
      for (const m of rankedMatches.slice(0, 10)) {
        await db.insertOne('matches', {
          shipmentId: persistedShipmentId,
          returnTripId: m.returnTrip._id,
          driverId: m.driver._id,
          vehicleId: m.vehicle._id,
          score: m.score,
          routeScore: m.routeScore,
          capacityScore: m.capacityScore,
          timeScore: m.timeScore,
          distanceScore: m.distanceScore,
          estimatedFare: m.estimatedFare,
          detourKm: m.detourKm,
          explanation: m.explanation,
          calculationMethod: m.calculationMethod,
        });
      }
      if (rankedMatches.length > 0) {
        const sh = await db.findById('shipmentRequests', persistedShipmentId);
        if (sh && sh.status === 'open') {
          await db.updateById('shipmentRequests', persistedShipmentId, { status: 'matched' });
        }
      }
    }

    res.json({
      query,
      weights: {
        routeCompatibility: 40,
        capacityCompatibility: 25,
        timeCompatibility: 20,
        distanceDeviation: 15,
      },
      totalEvaluated: openTrips.length,
      matchedCount: rankedMatches.length,
      rejectedCount: rejectedReasons.length,
      matches: rankedMatches,
      rejectedSample: rejectedReasons.slice(0, 5),
      calculationNotice:
        'Distances and scores are computed using RouteBack weighted corridor heuristics; live Google Maps routes render interactively when viewing route details.',
    });
  } catch (err) {
    console.error('[Matching Search Error]', err);
    res.status(500).json({ error: 'Smart matching failed.' });
  }
});

// Driver Smart Matching: Find matching open shipments for one of the driver's return trips
tripAndShipmentRouter.get(
  '/matching/for-trip/:tripId',
  requireAuth,
  requireRole('driver', 'owner'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const trip = await db.findById('returnTrips', req.params.tripId);
      if (!trip) {
        res.status(404).json({ error: 'Return trip not found.' });
        return;
      }

      const driver = await db.findById('drivers', trip.driverId);
      const drvUser = driver ? await db.findById('users', driver.userId) : null;
      const veh = await db.findById('vehicles', trip.vehicleId);
      if (!driver || !drvUser || !veh) {
        res.status(404).json({ error: 'Driver or vehicle data missing.' });
        return;
      }

      const openShipments = await db.find('shipmentRequests', {
        status: { $in: ['open', 'matched'] },
      });
      const customers = await db.find('customers');
      const users = await db.find('users');
      const custMap = new Map(customers.map((c) => [c._id, c]));
      const userMap = new Map(users.map((u) => [u._id, u]));

      const opportunities = [];
      for (const sh of openShipments) {
        const evalRes = evaluateTripMatch(sh, trip, driver, drvUser, veh);
        if (evalRes.suitable && evalRes.result) {
          const cust = custMap.get(sh.customerId);
          const custUser = cust ? userMap.get(cust.userId) : null;
          opportunities.push({
            shipment: sh,
            customerName: custUser?.fullName || 'Verified Customer',
            score: evalRes.result.score,
            routeScore: evalRes.result.routeScore,
            capacityScore: evalRes.result.capacityScore,
            timeScore: evalRes.result.timeScore,
            distanceScore: evalRes.result.distanceScore,
            detourKm: evalRes.result.detourKm,
            estimatedFare: evalRes.result.estimatedFare,
            explanation: evalRes.result.explanation,
          });
        }
      }

      opportunities.sort((a, b) => b.score - a.score);
      res.json({ trip, opportunities });
    } catch (err) {
      console.error('[Matching For Trip Error]', err);
      res.status(500).json({ error: 'Failed to evaluate shipment matches.' });
    }
  }
);

tripAndShipmentRouter.post('/matching/fare-estimate', (req, res) => {
  const {
    pickupLocation,
    deliveryLocation,
    weightKg,
    vehicleType,
    detourKm,
    driverExpectedPrice,
  } = req.body as Record<string, unknown>;

  const pCoords = resolveLocationCoords(String(pickupLocation || 'Mysuru'));
  const dCoords = resolveLocationCoords(String(deliveryLocation || 'Bengaluru'));
  const distanceKm = estimateRoadDistanceKm(pCoords, dCoords);

  const estimate = calculateEstimatedFare({
    distanceKm,
    weightKg: Number(weightKg) || 300,
    vehicleType: (vehicleType as VehicleType) || 'Tata Ace (Mini Truck)',
    detourKm: Number(detourKm) || 0,
    driverExpectedPrice: driverExpectedPrice ? Number(driverExpectedPrice) : undefined,
  });

  res.json({ distanceKm, ...estimate });
});
