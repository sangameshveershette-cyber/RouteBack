import { Router } from 'express';
import { db } from '../db/adapter.ts';
import {
  hashPassword,
  requireAuth,
  signToken,
  verifyPassword,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import type {
  CustomerDoc,
  DriverDoc,
  UserDoc,
  UserRole,
  VehicleOwnerDoc,
} from '../types.ts';

export const authRouter = Router();

function sanitizeUser(user: UserDoc) {
  const { passwordHash: _removed, ...safe } = user;
  return safe;
}

async function buildSessionPayload(user: UserDoc) {
  let profile: CustomerDoc | DriverDoc | VehicleOwnerDoc | null = null;
  let assignedVehicle = null;

  if (user.role === 'customer') {
    profile = await db.findOne('customers', { userId: user._id });
  } else if (user.role === 'driver') {
    const drv = await db.findOne('drivers', { userId: user._id });
    profile = drv;
    if (drv?.assignedVehicleId) {
      assignedVehicle = await db.findById('vehicles', drv.assignedVehicleId);
    }
  } else if (user.role === 'owner') {
    profile = await db.findOne('vehicleOwners', { userId: user._id });
  }

  return {
    user: sanitizeUser(user),
    profile,
    assignedVehicle,
  };
}

authRouter.get('/demo-accounts', async (_req, res) => {
  res.json({
    note: 'Development & Hackathon Demonstration Credentials (stored in database)',
    passwordForAllDemoAccounts: 'RouteBack@2026',
    accounts: [
      {
        role: 'owner',
        label: 'Vehicle Owner Demo (Kaveri Logistics Fleet)',
        email: 'owner@routeback.in',
        mobile: '9845022201',
      },
      {
        role: 'driver',
        label: 'Driver Demo (Ramesh Kumar · Mysuru → Bengaluru Tata Ace)',
        email: 'driver@routeback.in',
        mobile: '9845011101',
      },
      {
        role: 'customer',
        label: 'Customer Demo (Ananya Sharma · Bengaluru)',
        email: 'customer@routeback.in',
        mobile: '9845033301',
      },
    ],
  });
});

authRouter.post('/register', async (req, res) => {
  try {
    const {
      role,
      fullName,
      ownerName,
      businessName,
      mobile,
      email,
      password,
      confirmPassword,
      address,
      licenceNumber,
      experienceYears,
      profilePhoto,
    } = req.body as Record<string, unknown>;

    const validRoles: UserRole[] = ['customer', 'driver', 'owner'];
    if (!role || !validRoles.includes(role as UserRole)) {
      res.status(400).json({ error: 'Invalid account role. Must be customer, driver, or owner.' });
      return;
    }

    const cleanRole = role as UserRole;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanMobile = String(mobile || '').trim();
    const cleanName = String(fullName || ownerName || '').trim();
    const cleanAddress = String(address || '').trim();
    const cleanPassword = String(password || '');

    if (!cleanName || !cleanEmail || !cleanMobile || !cleanAddress || !cleanPassword) {
      res.status(400).json({ error: 'All required fields must be completed.' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    if (!/^\d{10,13}$/.test(cleanMobile.replace(/[\s+-]/g, ''))) {
      res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
      return;
    }

    if (cleanPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    if (confirmPassword !== undefined && cleanPassword !== String(confirmPassword)) {
      res.status(400).json({ error: 'Password and confirm password do not match.' });
      return;
    }

    if (cleanRole === 'driver') {
      if (!String(licenceNumber || '').trim()) {
        res.status(400).json({ error: 'Driving licence number is required for drivers.' });
        return;
      }
      if (experienceYears === undefined || Number(experienceYears) < 0) {
        res.status(400).json({ error: 'Valid driving experience (in years) is required.' });
        return;
      }
    }

    const existingEmail = await db.findOne('users', { email: cleanEmail });
    if (existingEmail) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const existingMobile = await db.findOne('users', { mobile: cleanMobile });
    if (existingMobile) {
      res.status(409).json({ error: 'An account with this mobile number already exists.' });
      return;
    }

    const passwordHash = await hashPassword(cleanPassword);
    const user = await db.insertOne('users', {
      role: cleanRole,
      fullName: cleanName,
      mobile: cleanMobile,
      email: cleanEmail,
      passwordHash,
      address: cleanAddress,
      profilePhoto: String(profilePhoto || ''),
      isDemo: false,
    });

    if (cleanRole === 'customer') {
      await db.insertOne('customers', {
        userId: user._id,
        address: cleanAddress,
        totalSpent: 0,
        totalBookings: 0,
        isDemo: false,
      });
    } else if (cleanRole === 'driver') {
      await db.insertOne('drivers', {
        userId: user._id,
        licenceNumber: String(licenceNumber).trim().toUpperCase(),
        experienceYears: Number(experienceYears) || 1,
        address: cleanAddress,
        profilePhoto: String(profilePhoto || ''),
        assignedVehicleId: null,
        ownerId: null,
        ratingAvg: 5.0,
        ratingCount: 0,
        totalEarnings: 0,
        isDemo: false,
      });
    } else if (cleanRole === 'owner') {
      await db.insertOne('vehicleOwners', {
        userId: user._id,
        ownerName: String(ownerName || cleanName).trim(),
        businessName: String(businessName || '').trim(),
        address: cleanAddress,
        totalEarnings: 0,
        isDemo: false,
      });
    }

    await db.insertOne('notifications', {
      userId: user._id,
      title: 'Welcome to RouteBack',
      message: `Your ${cleanRole} account is active and ready.`,
      type: 'system',
      isRead: false,
    });

    const token = signToken({
      userId: user._id,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
    });

    const session = await buildSessionPayload(user);
    res.status(201).json({ token, ...session });
  } catch (err) {
    console.error('[Auth Register Error]', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { identifier, password, role } = req.body as {
      identifier?: string;
      password?: string;
      role?: UserRole;
    };

    const cleanId = String(identifier || '').trim().toLowerCase();
    const cleanPassword = String(password || '');

    if (!cleanId || !cleanPassword) {
      res.status(400).json({ error: 'Email/mobile and password are required.' });
      return;
    }

    const user = await db.findOne('users', {
      $or: [{ email: cleanId }, { mobile: cleanId }],
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials. No matching account found.' });
      return;
    }

    if (role && user.role !== role) {
      res.status(403).json({
        error: `This account is registered as a ${user.role.toUpperCase()}. Please use the ${user.role.toUpperCase()} login portal.`,
      });
      return;
    }

    const passwordOk = await verifyPassword(cleanPassword, user.passwordHash);
    if (!passwordOk) {
      res.status(401).json({ error: 'Invalid password. Please try again.' });
      return;
    }

    const token = signToken({
      userId: user._id,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
    });

    const session = await buildSessionPayload(user);
    res.json({ token, ...session });
  } catch (err) {
    console.error('[Auth Login Error]', err);
    res.status(500).json({ error: 'Login failed due to a server error.' });
  }
});

authRouter.post('/logout', (_req, res) => {
  res.json({ ok: true, message: 'Logged out successfully.' });
});

authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await db.findById('users', req.auth!.userId);
    if (!user) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }
    const session = await buildSessionPayload(user);
    res.json(session);
  } catch (err) {
    console.error('[Auth Me Error]', err);
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

authRouter.put('/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.auth!.userId;
    const user = await db.findById('users', userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const { fullName, address, profilePhoto, licenceNumber, experienceYears, businessName, ownerName } =
      req.body as Record<string, unknown>;

    const userUpdates: Partial<UserDoc> = {};
    if (typeof fullName === 'string' && fullName.trim()) userUpdates.fullName = fullName.trim();
    if (typeof address === 'string' && address.trim()) userUpdates.address = address.trim();
    if (typeof profilePhoto === 'string') userUpdates.profilePhoto = profilePhoto;

    const updatedUser = await db.updateById('users', userId, userUpdates);

    if (user.role === 'customer') {
      const cust = await db.findOne('customers', { userId });
      if (cust && typeof address === 'string' && address.trim()) {
        await db.updateById('customers', cust._id, { address: address.trim() });
      }
    } else if (user.role === 'driver') {
      const drv = await db.findOne('drivers', { userId });
      if (drv) {
        await db.updateById('drivers', drv._id, {
          address: typeof address === 'string' && address.trim() ? address.trim() : drv.address,
          profilePhoto: typeof profilePhoto === 'string' ? profilePhoto : drv.profilePhoto,
          licenceNumber:
            typeof licenceNumber === 'string' && licenceNumber.trim()
              ? licenceNumber.trim().toUpperCase()
              : drv.licenceNumber,
          experienceYears:
            experienceYears !== undefined ? Number(experienceYears) : drv.experienceYears,
        });
      }
    } else if (user.role === 'owner') {
      const own = await db.findOne('vehicleOwners', { userId });
      if (own) {
        await db.updateById('vehicleOwners', own._id, {
          ownerName:
            typeof ownerName === 'string' && ownerName.trim() ? ownerName.trim() : own.ownerName,
          businessName: typeof businessName === 'string' ? businessName.trim() : own.businessName,
          address: typeof address === 'string' && address.trim() ? address.trim() : own.address,
        });
      }
    }

    const session = await buildSessionPayload(updatedUser!);
    res.json(session);
  } catch (err) {
    console.error('[Profile Update Error]', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});
