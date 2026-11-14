import { Router } from 'express';
import { db } from '../db/adapter.ts';
import { hashPassword, requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.ts';
import type { VehicleType } from '../types.ts';

export const vehicleRouter = Router();

const VALID_VEHICLE_TYPES: VehicleType[] = [
  'Tata Ace (Mini Truck)',
  'Mahindra Bolero Pickup',
  'Ashok Leyland Dost',
  'Eicher Pro 14ft',
  'Tata 407 (LCV)',
  'BharatBenz 17ft Container',
  'Heavy Duty 22ft Truck',
];

async function hydrateVehicles(vehicles: Awaited<ReturnType<typeof db.find<'vehicles'>>>) {
  const drivers = await db.find('drivers');
  const users = await db.find('users');
  const owners = await db.find('vehicleOwners');

  const driverMap = new Map(drivers.map((d) => [d._id, d]));
  const userMap = new Map(users.map((u) => [u._id, u]));
  const ownerMap = new Map(owners.map((o) => [o._id, o]));

  return vehicles.map((v) => {
    const drv = v.assignedDriverId ? driverMap.get(v.assignedDriverId) : null;
    const drvUser = drv ? userMap.get(drv.userId) : null;
    const owner = ownerMap.get(v.ownerId);
    return {
      ...v,
      ownerName: owner?.ownerName || '',
      businessName: owner?.businessName || '',
      assignedDriver: drv && drvUser
        ? {
            _id: drv._id,
            userId: drvUser._id,
            fullName: drvUser.fullName,
            mobile: drvUser.mobile,
            email: drvUser.email,
            licenceNumber: drv.licenceNumber,
            experienceYears: drv.experienceYears,
            ratingAvg: drv.ratingAvg,
          }
        : null,
    };
  });
}

vehicleRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { role, userId } = req.auth!;
    if (role === 'owner') {
      const owner = await db.findOne('vehicleOwners', { userId });
      if (!owner) {
        res.status(404).json({ error: 'Vehicle owner profile not found.' });
        return;
      }
      const list = await db.find('vehicles', { ownerId: owner._id }, { sortBy: 'createdAt', sortDir: 'desc' });
      res.json({ vehicles: await hydrateVehicles(list) });
      return;
    }

    if (role === 'driver') {
      const driver = await db.findOne('drivers', { userId });
      if (!driver) {
        res.status(404).json({ error: 'Driver profile not found.' });
        return;
      }
      const assignments = await db.find('driverAssignments', {
        driverId: driver._id,
        status: 'active',
      });
      const assignedIds = new Set(assignments.map((a) => a.vehicleId));
      if (driver.assignedVehicleId) assignedIds.add(driver.assignedVehicleId);

      const all = await db.find('vehicles');
      const mine = all.filter((v) => assignedIds.has(v._id));
      res.json({ vehicles: await hydrateVehicles(mine) });
      return;
    }

    // Customer view: only available fleet summary
    const available = await db.find('vehicles', { status: 'available' });
    res.json({ vehicles: await hydrateVehicles(available) });
  } catch (err) {
    console.error('[Vehicles GET Error]', err);
    res.status(500).json({ error: 'Failed to load vehicles.' });
  }
});

vehicleRouter.get('/drivers', requireAuth, requireRole('owner'), async (req: AuthenticatedRequest, res) => {
  try {
    const owner = await db.findOne('vehicleOwners', { userId: req.auth!.userId });
    if (!owner) {
      res.status(404).json({ error: 'Owner profile not found.' });
      return;
    }

    const allDrivers = await db.find('drivers');
    const allUsers = await db.find('users', { role: 'driver' });
    const allVehicles = await db.find('vehicles');
    const userMap = new Map(allUsers.map((u) => [u._id, u]));
    const vehicleMap = new Map(allVehicles.map((v) => [v._id, v]));

    const hydrated = allDrivers
      .map((d) => {
        const u = userMap.get(d.userId);
        if (!u) return null;
        const veh = d.assignedVehicleId ? vehicleMap.get(d.assignedVehicleId) : null;
        return {
          _id: d._id,
          userId: u._id,
          fullName: u.fullName,
          email: u.email,
          mobile: u.mobile,
          licenceNumber: d.licenceNumber,
          experienceYears: d.experienceYears,
          address: d.address,
          ratingAvg: d.ratingAvg,
          totalEarnings: d.totalEarnings,
          ownerId: d.ownerId,
          belongsToCurrentOwner: d.ownerId === owner._id,
          assignedVehicle: veh
            ? {
                _id: veh._id,
                registrationNumber: veh.registrationNumber,
                vehicleType: veh.vehicleType,
                modelName: veh.modelName,
              }
            : null,
        };
      })
      .filter(Boolean);

    res.json({ drivers: hydrated });
  } catch (err) {
    console.error('[Owner Drivers GET Error]', err);
    res.status(500).json({ error: 'Failed to load drivers.' });
  }
});

vehicleRouter.post('/', requireAuth, requireRole('owner'), async (req: AuthenticatedRequest, res) => {
  try {
    const owner = await db.findOne('vehicleOwners', { userId: req.auth!.userId });
    if (!owner) {
      res.status(404).json({ error: 'Vehicle owner profile not found.' });
      return;
    }

    const {
      registrationNumber,
      vehicleType,
      capacityKg,
      modelName,
      photos,
      rcDocument,
      insuranceDocument,
    } = req.body as Record<string, unknown>;

    const reg = String(registrationNumber || '').trim().toUpperCase();
    const vType = String(vehicleType || '').trim() as VehicleType;
    const cap = Number(capacityKg);
    const model = String(modelName || vType).trim();

    if (!reg || !vType || !Number.isFinite(cap) || cap < 100) {
      res.status(400).json({
        error: 'Registration number, vehicle type, and capacity (>= 100 kg) are required.',
      });
      return;
    }

    if (!VALID_VEHICLE_TYPES.includes(vType)) {
      res.status(400).json({ error: 'Please select a valid commercial vehicle type.' });
      return;
    }

    const duplicate = await db.findOne('vehicles', { registrationNumber: reg });
    if (duplicate) {
      res.status(409).json({ error: `Vehicle ${reg} is already registered.` });
      return;
    }

    const defaultPhoto =
      vType.includes('Ace') || vType.includes('Bolero') || vType.includes('Dost')
        ? '/src/assets/images/vehicle_tata_ace_1794637558583.jpg'
        : '/src/assets/images/vehicle_eicher_canter_1794637558679.jpg';

    const photoList =
      Array.isArray(photos) && photos.length > 0 ? photos.map(String) : [defaultPhoto];

    const created = await db.insertOne('vehicles', {
      ownerId: owner._id,
      registrationNumber: reg,
      vehicleType: vType,
      capacityKg: cap,
      modelName: model,
      photos: photoList,
      rcDocument: String(rcDocument || `RC-${reg}.pdf`),
      insuranceDocument: String(insuranceDocument || `INS-${reg}.pdf`),
      status: 'available',
      assignedDriverId: null,
      isDemo: false,
    });

    const [hydrated] = await hydrateVehicles([created]);
    res.status(201).json({ vehicle: hydrated });
  } catch (err) {
    console.error('[Vehicle POST Error]', err);
    res.status(500).json({ error: 'Failed to add vehicle.' });
  }
});

vehicleRouter.put('/:id', requireAuth, requireRole('owner'), async (req: AuthenticatedRequest, res) => {
  try {
    const owner = await db.findOne('vehicleOwners', { userId: req.auth!.userId });
    const vehicle = await db.findById('vehicles', req.params.id);
    if (!owner || !vehicle) {
      res.status(404).json({ error: 'Vehicle not found.' });
      return;
    }
    if (vehicle.ownerId !== owner._id) {
      res.status(403).json({ error: 'You do not have permission to edit another owner’s vehicle.' });
      return;
    }

    const { vehicleType, capacityKg, modelName, status, rcDocument, insuranceDocument, photos } =
      req.body as Record<string, unknown>;

    const updates: Record<string, unknown> = {};
    if (typeof vehicleType === 'string' && VALID_VEHICLE_TYPES.includes(vehicleType as VehicleType)) {
      updates.vehicleType = vehicleType;
    }
    if (capacityKg !== undefined && Number(capacityKg) >= 100) {
      updates.capacityKg = Number(capacityKg);
    }
    if (typeof modelName === 'string' && modelName.trim()) {
      updates.modelName = modelName.trim();
    }
    if (status === 'available' || status === 'occupied' || status === 'maintenance') {
      updates.status = status;
    }
    if (typeof rcDocument === 'string') updates.rcDocument = rcDocument;
    if (typeof insuranceDocument === 'string') updates.insuranceDocument = insuranceDocument;
    if (Array.isArray(photos) && photos.length > 0) updates.photos = photos.map(String);

    const updated = await db.updateById('vehicles', vehicle._id, updates);
    const [hydrated] = await hydrateVehicles([updated!]);
    res.json({ vehicle: hydrated });
  } catch (err) {
    console.error('[Vehicle PUT Error]', err);
    res.status(500).json({ error: 'Failed to update vehicle.' });
  }
});

vehicleRouter.delete('/:id', requireAuth, requireRole('owner'), async (req: AuthenticatedRequest, res) => {
  try {
    const owner = await db.findOne('vehicleOwners', { userId: req.auth!.userId });
    const vehicle = await db.findById('vehicles', req.params.id);
    if (!owner || !vehicle) {
      res.status(404).json({ error: 'Vehicle not found.' });
      return;
    }
    if (vehicle.ownerId !== owner._id) {
      res.status(403).json({ error: 'You do not have permission to delete another owner’s vehicle.' });
      return;
    }

    const activeBookings = await db.find('bookings', {
      vehicleId: vehicle._id,
      status: {
        $in: ['Pending', 'Accepted', 'Confirmed', 'Pickup Scheduled', 'Picked Up', 'In Transit'],
      },
    });
    if (activeBookings.length > 0) {
      res.status(400).json({
        error: 'Cannot delete vehicle while it is involved in an active or pending booking.',
      });
      return;
    }

    if (vehicle.assignedDriverId) {
      await db.updateById('drivers', vehicle.assignedDriverId, { assignedVehicleId: null });
    }
    await db.updateMany(
      'driverAssignments',
      { vehicleId: vehicle._id, status: 'active' },
      { status: 'revoked' }
    );
    await db.deleteById('vehicles', vehicle._id);
    res.json({ ok: true, message: 'Vehicle removed from fleet.' });
  } catch (err) {
    console.error('[Vehicle DELETE Error]', err);
    res.status(500).json({ error: 'Failed to delete vehicle.' });
  }
});

// Owner can assign an existing driver OR create a new driver account and assign them directly
vehicleRouter.post(
  '/:id/assign-driver',
  requireAuth,
  requireRole('owner'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const owner = await db.findOne('vehicleOwners', { userId: req.auth!.userId });
      const vehicle = await db.findById('vehicles', req.params.id);
      if (!owner || !vehicle) {
        res.status(404).json({ error: 'Vehicle not found.' });
        return;
      }
      if (vehicle.ownerId !== owner._id) {
        res.status(403).json({ error: 'Access denied: vehicle belongs to another owner.' });
        return;
      }

      const {
        driverId,
        driverIdentifier,
        createNewDriver,
        fullName,
        email,
        mobile,
        password,
        licenceNumber,
        experienceYears,
        address,
      } = req.body as Record<string, unknown>;

      let targetDriver = driverId ? await db.findById('drivers', String(driverId)) : null;

      if (!targetDriver && driverIdentifier) {
        const clean = String(driverIdentifier).trim().toLowerCase();
        const drvUser = await db.findOne('users', {
          role: 'driver',
          $or: [{ email: clean }, { mobile: clean }],
        });
        if (drvUser) {
          targetDriver = await db.findOne('drivers', { userId: drvUser._id });
        }
      }

      if (!targetDriver && createNewDriver) {
        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanMobile = String(mobile || '').trim();
        const cleanName = String(fullName || '').trim();
        const cleanLic = String(licenceNumber || '').trim().toUpperCase();
        const cleanPassword = String(password || 'RouteBack@2026');

        if (!cleanName || !cleanEmail || !cleanMobile || !cleanLic) {
          res.status(400).json({
            error: 'New driver requires full name, email, mobile number, and driving licence number.',
          });
          return;
        }

        const existingUser = await db.findOne('users', {
          $or: [{ email: cleanEmail }, { mobile: cleanMobile }],
        });
        if (existingUser) {
          res.status(409).json({
            error: 'A user with that email or mobile already exists. Select them as an existing driver instead.',
          });
          return;
        }

        const passwordHash = await hashPassword(cleanPassword);
        const newUser = await db.insertOne('users', {
          role: 'driver',
          fullName: cleanName,
          mobile: cleanMobile,
          email: cleanEmail,
          passwordHash,
          address: String(address || owner.address),
          profilePhoto: '',
          isDemo: false,
        });

        targetDriver = await db.insertOne('drivers', {
          userId: newUser._id,
          licenceNumber: cleanLic,
          experienceYears: Number(experienceYears) || 2,
          address: String(address || owner.address),
          profilePhoto: '',
          assignedVehicleId: null,
          ownerId: owner._id,
          ratingAvg: 5.0,
          ratingCount: 0,
          totalEarnings: 0,
          isDemo: false,
        });
      }

      if (!targetDriver) {
        res.status(404).json({
          error: 'Matching driver not found. Provide a valid driver or create a new driver account.',
        });
        return;
      }

      // Revoke previous driver on this vehicle if any
      if (vehicle.assignedDriverId && vehicle.assignedDriverId !== targetDriver._id) {
        await db.updateById('drivers', vehicle.assignedDriverId, { assignedVehicleId: null });
      }
      await db.updateMany(
        'driverAssignments',
        { vehicleId: vehicle._id, status: 'active' },
        { status: 'revoked' }
      );

      // Revoke previous vehicle if target driver had one
      if (targetDriver.assignedVehicleId && targetDriver.assignedVehicleId !== vehicle._id) {
        await db.updateById('vehicles', targetDriver.assignedVehicleId, {
          assignedDriverId: null,
        });
        await db.updateMany(
          'driverAssignments',
          { driverId: targetDriver._id, status: 'active' },
          { status: 'revoked' }
        );
      }

      const updatedVehicle = await db.updateById('vehicles', vehicle._id, {
        assignedDriverId: targetDriver._id,
      });
      await db.updateById('drivers', targetDriver._id, {
        assignedVehicleId: vehicle._id,
        ownerId: owner._id,
      });
      await db.insertOne('driverAssignments', {
        vehicleId: vehicle._id,
        driverId: targetDriver._id,
        ownerId: owner._id,
        status: 'active',
        assignedAt: new Date().toISOString(),
      });

      await db.insertOne('notifications', {
        userId: targetDriver.userId,
        title: 'Vehicle Assigned to You',
        message: `${owner.businessName || owner.ownerName} assigned ${vehicle.modelName} (${vehicle.registrationNumber}) to your driver account.`,
        type: 'vehicle',
        relatedId: vehicle._id,
        isRead: false,
      });

      const [hydrated] = await hydrateVehicles([updatedVehicle!]);
      res.json({ vehicle: hydrated, assignedDriverId: targetDriver._id });
    } catch (err) {
      console.error('[Assign Driver Error]', err);
      res.status(500).json({ error: 'Failed to assign driver to vehicle.' });
    }
  }
);
