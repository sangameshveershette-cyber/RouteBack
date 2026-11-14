import { db } from './adapter.ts';
import { hashPassword } from '../middleware/auth.ts';
import {
  estimateRoadDistanceKm,
  estimateTravelDurationMin,
  interpolateCoords,
  resolveLocationCoords,
} from '../services/geoService.ts';
import { evaluateTripMatch } from '../services/matchingService.ts';
import type {
  CustomerDoc,
  DriverDoc,
  ReturnTripDoc,
  ShipmentRequestDoc,
  UserDoc,
  VehicleDoc,
  VehicleOwnerDoc,
  VehicleType,
} from '../types.ts';

const VEHICLE_IMAGE_MINI = '/src/assets/images/vehicle_tata_ace_1794637558583.jpg';
const VEHICLE_IMAGE_CANTER = '/src/assets/images/vehicle_eicher_canter_1794637558679.jpg';

export async function seedDemoDatabase(): Promise<void> {
  const existingUsers = await db.count('users');
  if (existingUsers > 0) {
    return;
  }

  console.log('[RouteBack Seed] Seeding realistic Indian logistics demo dataset across 14 collections...');
  const demoPasswordHash = await hashPassword('RouteBack@2026');

  // 1. Create 5 Vehicle Owners
  const ownerSpecs = [
    {
      fullName: 'Kaveri Logistics Fleet',
      ownerName: 'Suresh Gowda',
      businessName: 'Kaveri Highway Freight Pvt Ltd',
      email: 'owner@routeback.in',
      mobile: '9845022201',
      address: 'Peenya Industrial Area Phase 2, Bengaluru, Karnataka',
    },
    {
      fullName: 'Deccan Cargo Carriers',
      ownerName: 'Prakash Kulkarni',
      businessName: 'Deccan Cargo Carriers',
      email: 'deccan.owner@routeback.in',
      mobile: '9845022202',
      address: 'Hebbal Industrial Estate, Mysuru, Karnataka',
    },
    {
      fullName: 'Coromandel Transport Co',
      ownerName: 'Venkatesh Iyer',
      businessName: 'Coromandel Express Logistics',
      email: 'coromandel.owner@routeback.in',
      mobile: '9845022203',
      address: 'Ambattur Industrial Estate, Chennai, Tamil Nadu',
    },
    {
      fullName: 'Nizam Freight Movers',
      ownerName: 'Farhan Siddiqui',
      businessName: 'Nizam Freight Movers',
      email: 'nizam.owner@routeback.in',
      mobile: '9845022204',
      address: 'Autonagar Transport Hub, Hyderabad, Telangana',
    },
    {
      fullName: 'Sahyadri Commercial Fleet',
      ownerName: 'Nikhil Deshmukh',
      businessName: 'Sahyadri Fleet Solutions',
      email: 'sahyadri.owner@routeback.in',
      mobile: '9845022205',
      address: 'Chakan MIDC Phase 1, Pune, Maharashtra',
    },
  ];

  const owners: Array<{ user: UserDoc; owner: VehicleOwnerDoc }> = [];
  for (const spec of ownerSpecs) {
    const user = await db.insertOne('users', {
      role: 'owner',
      fullName: spec.fullName,
      mobile: spec.mobile,
      email: spec.email,
      passwordHash: demoPasswordHash,
      address: spec.address,
      profilePhoto: '',
      isDemo: true,
    });
    const owner = await db.insertOne('vehicleOwners', {
      userId: user._id,
      ownerName: spec.ownerName,
      businessName: spec.businessName,
      address: spec.address,
      totalEarnings: 0,
      isDemo: true,
    });
    owners.push({ user, owner });
  }

  // 2. Create 10 Drivers
  const driverSpecs = [
    {
      fullName: 'Ramesh Kumar',
      email: 'driver@routeback.in',
      mobile: '9845011101',
      licenceNumber: 'KA-09-20190045128',
      experienceYears: 7,
      address: 'Hootagalli, Mysuru, Karnataka',
      ownerIdx: 0,
      ratingAvg: 4.9,
    },
    {
      fullName: 'Mahesh Naik',
      email: 'mahesh.driver@routeback.in',
      mobile: '9845011102',
      licenceNumber: 'KA-01-20170089231',
      experienceYears: 9,
      address: 'Yeshwanthpur, Bengaluru, Karnataka',
      ownerIdx: 0,
      ratingAvg: 4.8,
    },
    {
      fullName: 'Karthik Raj',
      email: 'karthik.driver@routeback.in',
      mobile: '9845011103',
      licenceNumber: 'TN-07-20200012984',
      experienceYears: 5,
      address: 'Guindy, Chennai, Tamil Nadu',
      ownerIdx: 2,
      ratingAvg: 4.7,
    },
    {
      fullName: 'Syed Imran',
      email: 'imran.driver@routeback.in',
      mobile: '9845011104',
      licenceNumber: 'TS-09-20180077412',
      experienceYears: 8,
      address: 'LB Nagar, Hyderabad, Telangana',
      ownerIdx: 3,
      ratingAvg: 4.8,
    },
    {
      fullName: 'Ganesh Patil',
      email: 'ganesh.driver@routeback.in',
      mobile: '9845011105',
      licenceNumber: 'MH-12-20160033819',
      experienceYears: 11,
      address: 'Wakad, Pune, Maharashtra',
      ownerIdx: 4,
      ratingAvg: 4.9,
    },
    {
      fullName: 'Manjunath Shetty',
      email: 'manjunath.driver@routeback.in',
      mobile: '9845011106',
      licenceNumber: 'KA-19-20190065410',
      experienceYears: 6,
      address: 'Baikampady, Mangaluru, Karnataka',
      ownerIdx: 1,
      ratingAvg: 4.7,
    },
    {
      fullName: 'Basavaraj Hiremath',
      email: 'basavaraj.driver@routeback.in',
      mobile: '9845011107',
      licenceNumber: 'KA-06-20180019283',
      experienceYears: 7,
      address: 'Batawadi, Tumakuru, Karnataka',
      ownerIdx: 0,
      ratingAvg: 4.6,
    },
    {
      fullName: 'Arjun Reddy',
      email: 'arjun.driver@routeback.in',
      mobile: '9845011108',
      licenceNumber: 'TS-07-20210044210',
      experienceYears: 4,
      address: 'Kukatpally, Hyderabad, Telangana',
      ownerIdx: 3,
      ratingAvg: 4.7,
    },
    {
      fullName: 'Santosh Hegde',
      email: 'santosh.driver@routeback.in',
      mobile: '9845011109',
      licenceNumber: 'KA-09-20150091827',
      experienceYears: 12,
      address: 'Kuvempunagar, Mysuru, Karnataka',
      ownerIdx: 1,
      ratingAvg: 4.9,
    },
    {
      fullName: 'Vignesh Murugan',
      email: 'vignesh.driver@routeback.in',
      mobile: '9845011110',
      licenceNumber: 'TN-09-20190051209',
      experienceYears: 6,
      address: 'Sriperumbudur, Chennai, Tamil Nadu',
      ownerIdx: 2,
      ratingAvg: 4.8,
    },
  ];

  const drivers: Array<{ user: UserDoc; driver: DriverDoc }> = [];
  for (const spec of driverSpecs) {
    const user = await db.insertOne('users', {
      role: 'driver',
      fullName: spec.fullName,
      mobile: spec.mobile,
      email: spec.email,
      passwordHash: demoPasswordHash,
      address: spec.address,
      profilePhoto: '',
      isDemo: true,
    });
    const driver = await db.insertOne('drivers', {
      userId: user._id,
      licenceNumber: spec.licenceNumber,
      experienceYears: spec.experienceYears,
      address: spec.address,
      profilePhoto: '',
      assignedVehicleId: null,
      ownerId: owners[spec.ownerIdx].owner._id,
      ratingAvg: spec.ratingAvg,
      ratingCount: 12,
      totalEarnings: 0,
      isDemo: true,
    });
    drivers.push({ user, driver });
  }

  // 3. Create 15 Vehicles across the 5 owners & assign drivers to the first 10
  const vehicleSpecs: Array<{
    ownerIdx: number;
    reg: string;
    type: VehicleType;
    cap: number;
    model: string;
    driverIdx: number | null;
    status: 'available' | 'occupied';
  }> = [
    { ownerIdx: 0, reg: 'KA-09-AA-4821', type: 'Tata Ace (Mini Truck)', cap: 850, model: 'Tata Ace Gold Diesel', driverIdx: 0, status: 'available' },
    { ownerIdx: 0, reg: 'KA-01-MG-7742', type: 'Eicher Pro 14ft', cap: 4500, model: 'Eicher Pro 2049 14ft', driverIdx: 1, status: 'available' },
    { ownerIdx: 2, reg: 'TN-07-CX-1904', type: 'Mahindra Bolero Pickup', cap: 1250, model: 'Bolero Pik-Up FB 1.25T', driverIdx: 2, status: 'available' },
    { ownerIdx: 3, reg: 'TS-09-UB-6620', type: 'Tata 407 (LCV)', cap: 2500, model: 'Tata 407 Gold SFC', driverIdx: 3, status: 'available' },
    { ownerIdx: 4, reg: 'MH-12-TR-9034', type: 'BharatBenz 17ft Container', cap: 7000, model: 'BharatBenz 1015R 17ft', driverIdx: 4, status: 'available' },
    { ownerIdx: 1, reg: 'KA-19-AD-3318', type: 'Ashok Leyland Dost', cap: 1500, model: 'Dost+ LS Commercial', driverIdx: 5, status: 'available' },
    { ownerIdx: 0, reg: 'KA-06-N-5582', type: 'Tata Ace (Mini Truck)', cap: 800, model: 'Tata Ace HT Plus', driverIdx: 6, status: 'available' },
    { ownerIdx: 3, reg: 'TS-07-EF-2491', type: 'Eicher Pro 14ft', cap: 4200, model: 'Eicher Pro 2059 XP', driverIdx: 7, status: 'available' },
    { ownerIdx: 1, reg: 'KA-09-GH-8110', type: 'Tata 407 (LCV)', cap: 2400, model: 'Tata 407 Ex2', driverIdx: 8, status: 'available' },
    { ownerIdx: 2, reg: 'TN-09-KL-4012', type: 'Heavy Duty 22ft Truck', cap: 11500, model: 'Ashok Leyland Ecomet 1615', driverIdx: 9, status: 'available' },
    { ownerIdx: 0, reg: 'KA-01-ZZ-1129', type: 'Mahindra Bolero Pickup', cap: 1300, model: 'Bolero Maxitruck Plus', driverIdx: null, status: 'available' },
    { ownerIdx: 1, reg: 'KA-09-MM-2204', type: 'BharatBenz 17ft Container', cap: 6800, model: 'BharatBenz 1217C', driverIdx: null, status: 'available' },
    { ownerIdx: 2, reg: 'TN-01-PQ-8830', type: 'Tata Ace (Mini Truck)', cap: 850, model: 'Tata Ace Zip XL', driverIdx: null, status: 'available' },
    { ownerIdx: 3, reg: 'TS-08-RT-3901', type: 'Ashok Leyland Dost', cap: 1450, model: 'Dost Strong', driverIdx: null, status: 'available' },
    { ownerIdx: 4, reg: 'MH-14-WX-7415', type: 'Eicher Pro 14ft', cap: 4600, model: 'Eicher Pro 3015', driverIdx: null, status: 'available' },
  ];

  const vehicles: VehicleDoc[] = [];
  for (const spec of vehicleSpecs) {
    const ownerObj = owners[spec.ownerIdx].owner;
    const assignedDriver = spec.driverIdx !== null ? drivers[spec.driverIdx].driver : null;
    const isMini =
      spec.type.includes('Ace') || spec.type.includes('Bolero') || spec.type.includes('Dost');

    const vehicle = await db.insertOne('vehicles', {
      ownerId: ownerObj._id,
      registrationNumber: spec.reg,
      vehicleType: spec.type,
      capacityKg: spec.cap,
      modelName: spec.model,
      photos: [isMini ? VEHICLE_IMAGE_MINI : VEHICLE_IMAGE_CANTER],
      rcDocument: `RC-${spec.reg}-VERIFIED.pdf`,
      insuranceDocument: `INS-${spec.reg}-VALID-2027.pdf`,
      status: spec.status,
      assignedDriverId: assignedDriver ? assignedDriver._id : null,
      isDemo: true,
    });
    vehicles.push(vehicle);

    if (assignedDriver) {
      await db.updateById('drivers', assignedDriver._id, {
        assignedVehicleId: vehicle._id,
        ownerId: ownerObj._id,
      });
      assignedDriver.assignedVehicleId = vehicle._id;

      await db.insertOne('driverAssignments', {
        vehicleId: vehicle._id,
        driverId: assignedDriver._id,
        ownerId: ownerObj._id,
        status: 'active',
        assignedAt: new Date().toISOString(),
      });
    }
  }

  // 4. Create 15 Customer accounts
  const customerSpecs = [
    { fullName: 'Ananya Sharma', email: 'customer@routeback.in', mobile: '9845033301', address: 'Indiranagar 100ft Road, Bengaluru' },
    { fullName: 'Vikramaditya Rao', email: 'vikram.rao@routeback.in', mobile: '9845033302', address: 'Vijayanagar 2nd Stage, Mysuru' },
    { fullName: 'Priya Menon', email: 'priya.menon@routeback.in', mobile: '9845033303', address: 'T. Nagar, Chennai' },
    { fullName: 'Siddharth Verma', email: 'siddharth.v@routeback.in', mobile: '9845033304', address: 'Madhapur, Hyderabad' },
    { fullName: 'Meera Deshpande', email: 'meera.d@routeback.in', mobile: '9845033305', address: 'Kothrud, Pune' },
    { fullName: 'Rohan Shetty', email: 'rohan.shetty@routeback.in', mobile: '9845033306', address: 'Bejai, Mangaluru' },
    { fullName: 'Deepak Jain', email: 'deepak.jain@routeback.in', mobile: '9845033307', address: 'Chickpet, Bengaluru' },
    { fullName: 'Kavitha Nair', email: 'kavitha.nair@routeback.in', mobile: '9845033308', address: 'Sitabuldi / Tumakuru Road, Tumakuru' },
    { fullName: 'Nitin Agrawal', email: 'nitin.a@routeback.in', mobile: '9845033309', address: 'Electronic City, Bengaluru' },
    { fullName: 'Divya Krishnan', email: 'divya.k@routeback.in', mobile: '9845033310', address: 'Adyar, Chennai' },
    { fullName: 'Harish Gowda', email: 'harish.g@routeback.in', mobile: '9845033311', address: 'Gokulam, Mysuru' },
    { fullName: 'Sneha Kulkarni', email: 'sneha.k@routeback.in', mobile: '9845033312', address: 'Baner, Pune' },
    { fullName: 'Tarun Reddy', email: 'tarun.r@routeback.in', mobile: '9845033313', address: 'Gachibowli, Hyderabad' },
    { fullName: 'Lakshmi Bhat', email: 'lakshmi.b@routeback.in', mobile: '9845033314', address: 'Hampankatta, Mangaluru' },
    { fullName: 'Arvind Patel', email: 'arvind.p@routeback.in', mobile: '9845033315', address: 'Bommasandra, Bengaluru' },
  ];

  const customers: Array<{ user: UserDoc; customer: CustomerDoc }> = [];
  for (const spec of customerSpecs) {
    const user = await db.insertOne('users', {
      role: 'customer',
      fullName: spec.fullName,
      mobile: spec.mobile,
      email: spec.email,
      passwordHash: demoPasswordHash,
      address: spec.address,
      profilePhoto: '',
      isDemo: true,
    });
    const customer = await db.insertOne('customers', {
      userId: user._id,
      address: spec.address,
      totalSpent: 0,
      totalBookings: 0,
      isDemo: true,
    });
    customers.push({ user, customer });
  }

  // 5. Create 20 Return-Trip Posts across the 7 required Indian cities
  // Trip #0 is the canonical SIH example: Mysuru -> Bengaluru, 800 kg, Tata Ace, 2026-11-20
  const tripSpecs = [
    { dIdx: 0, from: 'Mysuru', to: 'Bengaluru', date: '2026-11-20', time: '09:30', cap: 800, price: 2100 },
    { dIdx: 1, from: 'Bengaluru', to: 'Chennai', date: '2026-11-20', time: '14:00', cap: 3200, price: 6800 },
    { dIdx: 2, from: 'Chennai', to: 'Bengaluru', date: '2026-11-21', time: '07:00', cap: 1100, price: 4200 },
    { dIdx: 3, from: 'Hyderabad', to: 'Bengaluru', date: '2026-11-20', time: '18:00', cap: 2200, price: 7900 },
    { dIdx: 4, from: 'Pune', to: 'Bengaluru', date: '2026-11-22', time: '06:00', cap: 5500, price: 14500 },
    { dIdx: 5, from: 'Mangaluru', to: 'Bengaluru', date: '2026-11-20', time: '08:00', cap: 1300, price: 4900 },
    { dIdx: 6, from: 'Tumakuru', to: 'Bengaluru', date: '2026-11-20', time: '11:00', cap: 750, price: 1400 },
    { dIdx: 7, from: 'Bengaluru', to: 'Hyderabad', date: '2026-11-21', time: '20:00', cap: 3800, price: 9600 },
    { dIdx: 8, from: 'Mysuru', to: 'Mangaluru', date: '2026-11-21', time: '10:00', cap: 2000, price: 4600 },
    { dIdx: 9, from: 'Chennai', to: 'Hyderabad', date: '2026-11-22', time: '05:30', cap: 9500, price: 15800 },
    { dIdx: 0, from: 'Bengaluru', to: 'Tumakuru', date: '2026-11-23', time: '15:00', cap: 800, price: 1350 },
    { dIdx: 1, from: 'Tumakuru', to: 'Pune', date: '2026-11-23', time: '08:30', cap: 4000, price: 12200 },
    { dIdx: 2, from: 'Vellore', to: 'Chennai', date: '2026-11-20', time: '16:00', cap: 1000, price: 2200 },
    { dIdx: 3, from: 'Kurnool', to: 'Hyderabad', date: '2026-11-22', time: '12:00', cap: 1800, price: 3400 },
    { dIdx: 4, from: 'Hubballi', to: 'Pune', date: '2026-11-21', time: '09:00', cap: 6000, price: 8900 },
    { dIdx: 5, from: 'Hassan', to: 'Bengaluru', date: '2026-11-22', time: '13:30', cap: 1200, price: 2900 },
    { dIdx: 6, from: 'Mandya', to: 'Bengaluru', date: '2026-11-20', time: '11:30', cap: 700, price: 1650 },
    { dIdx: 7, from: 'Anantapur', to: 'Bengaluru', date: '2026-11-24', time: '07:30', cap: 3500, price: 4800 },
    { dIdx: 8, from: 'Mysuru', to: 'Bengaluru', date: '2026-11-21', time: '17:00', cap: 2100, price: 2800 },
    { dIdx: 9, from: 'Hyderabad', to: 'Pune', date: '2026-11-25', time: '06:00', cap: 10000, price: 14200 },
  ];

  const returnTrips: ReturnTripDoc[] = [];
  for (const spec of tripSpecs) {
    const drv = drivers[spec.dIdx].driver;
    const veh = vehicles[spec.dIdx];
    const fromCoords = resolveLocationCoords(spec.from);
    const toCoords = resolveLocationCoords(spec.to);
    const distanceKm = estimateRoadDistanceKm(fromCoords, toCoords);
    const durationMin = estimateTravelDurationMin(distanceKm);

    const trip = await db.insertOne('returnTrips', {
      driverId: drv._id,
      vehicleId: veh._id,
      ownerId: veh.ownerId,
      currentLocation: spec.from,
      returnDestination: spec.to,
      currentCoords: fromCoords,
      destinationCoords: toCoords,
      departureDate: spec.date,
      departureTime: spec.time,
      availableCapacityKg: spec.cap,
      vehicleType: veh.vehicleType,
      expectedPrice: spec.price,
      distanceKm,
      estimatedDurationMin: durationMin,
      status: 'open',
      ownerApproved: true,
      notes: 'Verified empty return leg available for part-load or dedicated goods.',
      isDemo: true,
    });
    returnTrips.push(trip);
  }

  // 6. Create 20 Shipment Requests
  const shipmentSpecs = [
    { cIdx: 0, from: 'Mysuru', to: 'Bengaluru', date: '2026-11-20', cat: 'Electronics & Appliances', wt: 300, dim: '120x90x80 cm', pref: 'Suitable small commercial vehicle' },
    { cIdx: 1, from: 'Mandya', to: 'Bengaluru', date: '2026-11-20', cat: 'Agri Produce & Coffee', wt: 450, dim: '8 gunny sacks', pref: 'Tata Ace (Mini Truck)' },
    { cIdx: 2, from: 'Bengaluru', to: 'Chennai', date: '2026-11-20', cat: 'Industrial Spare Parts', wt: 1400, dim: '3 Euro pallets', pref: 'Eicher Pro 14ft' },
    { cIdx: 3, from: 'Chennai', to: 'Bengaluru', date: '2026-11-21', cat: 'Textiles & Garments', wt: 650, dim: '18 cartons', pref: 'Mahindra Bolero Pickup' },
    { cIdx: 4, from: 'Hyderabad', to: 'Bengaluru', date: '2026-11-20', cat: 'Pharmaceuticals (Ambient)', wt: 900, dim: '24 sealed boxes', pref: 'Tata 407 (LCV)' },
    { cIdx: 5, from: 'Pune', to: 'Bengaluru', date: '2026-11-22', cat: 'Automotive Components', wt: 2800, dim: '4 wooden crates', pref: 'BharatBenz 17ft Container' },
    { cIdx: 6, from: 'Mangaluru', to: 'Bengaluru', date: '2026-11-20', cat: 'Packaged Spices & Cashews', wt: 780, dim: '30 cartons', pref: 'Ashok Leyland Dost' },
    { cIdx: 7, from: 'Tumakuru', to: 'Bengaluru', date: '2026-11-20', cat: 'Hardware & Plumbing', wt: 420, dim: '10 bundles', pref: 'Tata Ace (Mini Truck)' },
    { cIdx: 8, from: 'Bengaluru', to: 'Hyderabad', date: '2026-11-21', cat: 'FMCG & Packaged Food', wt: 2100, dim: '65 cartons', pref: 'Eicher Pro 14ft' },
    { cIdx: 9, from: 'Mysuru', to: 'Mangaluru', date: '2026-11-21', cat: 'Handicrafts & Furniture', wt: 950, dim: '12 wrapped crates', pref: 'Tata 407 (LCV)' },
    { cIdx: 10, from: 'Chennai', to: 'Hyderabad', date: '2026-11-22', cat: 'Steel Fabrication Units', wt: 4800, dim: '6 pallets', pref: 'Heavy Duty 22ft Truck' },
    { cIdx: 11, from: 'Vellore', to: 'Chennai', date: '2026-11-20', cat: 'Leather Goods', wt: 520, dim: '15 boxes', pref: 'Any Suitable Vehicle' },
    { cIdx: 12, from: 'Kurnool', to: 'Hyderabad', date: '2026-11-22', cat: 'Solar Inverter Panels', wt: 1100, dim: '20 boxes', pref: 'Tata 407 (LCV)' },
    { cIdx: 13, from: 'Hubballi', to: 'Pune', date: '2026-11-21', cat: 'Machinery Assemblies', wt: 3200, dim: '2 skids', pref: 'BharatBenz 17ft Container' },
    { cIdx: 14, from: 'Hassan', to: 'Bengaluru', date: '2026-11-22', cat: 'Plantation Produce', wt: 680, dim: '14 sacks', pref: 'Any Suitable Vehicle' },
    { cIdx: 0, from: 'Mysuru', to: 'Bengaluru', date: '2026-11-21', cat: 'Office Relocation Boxes', wt: 550, dim: '22 cartons', pref: 'Tata 407 (LCV)' },
    { cIdx: 1, from: 'Anantapur', to: 'Bengaluru', date: '2026-11-24', cat: 'Ceramic Tiles', wt: 2400, dim: '40 boxes', pref: 'Eicher Pro 14ft' },
    { cIdx: 2, from: 'Bengaluru', to: 'Tumakuru', date: '2026-11-23', cat: 'Retail Store Inventory', wt: 380, dim: '12 crates', pref: 'Tata Ace (Mini Truck)' },
    { cIdx: 3, from: 'Hyderabad', to: 'Pune', date: '2026-11-25', cat: 'Packaging Materials', wt: 5400, dim: '10 pallets', pref: 'Heavy Duty 22ft Truck' },
    { cIdx: 4, from: 'Tumakuru', to: 'Pune', date: '2026-11-23', cat: 'Electrical Transformers', wt: 1900, dim: '2 crates', pref: 'Eicher Pro 14ft' },
  ];

  const shipments: ShipmentRequestDoc[] = [];
  for (const spec of shipmentSpecs) {
    const cust = customers[spec.cIdx].customer;
    const pickupCoords = resolveLocationCoords(spec.from);
    const deliveryCoords = resolveLocationCoords(spec.to);
    const estimatedDistanceKm = estimateRoadDistanceKm(pickupCoords, deliveryCoords);

    const reqDoc = await db.insertOne('shipmentRequests', {
      customerId: cust._id,
      pickupLocation: spec.from,
      deliveryLocation: spec.to,
      pickupCoords,
      deliveryCoords,
      pickupDate: spec.date,
      goodsCategory: spec.cat,
      weightKg: spec.wt,
      dimensions: spec.dim,
      preferredVehicleType: spec.pref,
      estimatedDistanceKm,
      status: 'open',
      notes: 'Standard commercial dock-to-dock loading.',
      isDemo: true,
    });
    shipments.push(reqDoc);
  }

  // 7. Compute and persist sample matches for the first 8 shipments
  for (let i = 0; i < 8; i++) {
    const sh = shipments[i];
    for (let j = 0; j < returnTrips.length; j++) {
      const tr = returnTrips[j];
      const drvEntry = drivers.find((d) => d.driver._id === tr.driverId);
      const veh = vehicles.find((v) => v._id === tr.vehicleId);
      if (!drvEntry || !veh) continue;
      const evaluation = evaluateTripMatch(sh, tr, drvEntry.driver, drvEntry.user, veh);
      if (evaluation.suitable && evaluation.result) {
        await db.insertOne('matches', {
          shipmentId: sh._id,
          returnTripId: tr._id,
          driverId: drvEntry.driver._id,
          vehicleId: veh._id,
          score: evaluation.result.score,
          routeScore: evaluation.result.routeScore,
          capacityScore: evaluation.result.capacityScore,
          timeScore: evaluation.result.timeScore,
          distanceScore: evaluation.result.distanceScore,
          estimatedFare: evaluation.result.estimatedFare,
          detourKm: evaluation.result.detourKm,
          explanation: evaluation.result.explanation,
          calculationMethod: evaluation.result.calculationMethod,
        });
      }
    }
  }

  // 8. Create sample historical & active bookings (leaving Trip #0 Mysuru -> Bengaluru open for the live SIH demo workflow!)
  const sampleBookingsSpec = [
    {
      code: 'RB-2026-1041',
      cIdx: 1,
      tIdx: 10,
      status: 'Delivered' as const,
      cat: 'Retail Hardware Cartons',
      wt: 420,
      fare: 1450,
    },
    {
      code: 'RB-2026-1042',
      cIdx: 2,
      tIdx: 11,
      status: 'Delivered' as const,
      cat: 'Precision CNC Tooling',
      wt: 1850,
      fare: 11900,
    },
    {
      code: 'RB-2026-1043',
      cIdx: 3,
      tIdx: 12,
      status: 'In Transit' as const,
      cat: 'Finished Leather Goods',
      wt: 510,
      fare: 2150,
    },
    {
      code: 'RB-2026-1044',
      cIdx: 4,
      tIdx: 13,
      status: 'Confirmed' as const,
      cat: 'Solar Inverter Equipment',
      wt: 980,
      fare: 3350,
    },
    {
      code: 'RB-2026-1045',
      cIdx: 5,
      tIdx: 14,
      status: 'Delivered' as const,
      cat: 'Industrial Pump Assemblies',
      wt: 2900,
      fare: 8800,
    },
    {
      code: 'RB-2026-1046',
      cIdx: 0,
      tIdx: 15,
      status: 'Pending' as const,
      cat: 'Coffee Estate Supplies',
      wt: 620,
      fare: 2850,
    },
  ];

  for (const bk of sampleBookingsSpec) {
    const trip = returnTrips[bk.tIdx];
    const cust = customers[bk.cIdx].customer;
    const custUser = customers[bk.cIdx].user;
    const drvEntry = drivers.find((d) => d.driver._id === trip.driverId)!;
    const veh = vehicles.find((v) => v._id === trip.vehicleId)!;

    const booking = await db.insertOne('bookings', {
      bookingCode: bk.code,
      customerId: cust._id,
      driverId: drvEntry.driver._id,
      vehicleId: veh._id,
      ownerId: veh.ownerId,
      returnTripId: trip._id,
      shipmentId: null,
      pickupLocation: trip.currentLocation,
      deliveryLocation: trip.returnDestination,
      pickupCoords: trip.currentCoords,
      deliveryCoords: trip.destinationCoords,
      pickupDate: trip.departureDate,
      goodsCategory: bk.cat,
      weightKg: bk.wt,
      dimensions: 'Standard commercial pallets',
      agreedFare: bk.fare,
      driverRequestedFare: trip.expectedPrice,
      distanceKm: trip.distanceKm,
      detourKm: 4,
      matchScore: 93,
      status: bk.status,
      driverAccepted: bk.status !== 'Pending',
      ownerApproved: true,
      rejectionReason: '',
      cancelledBy: null,
      isDemo: true,
    });

    if (bk.status === 'Delivered') {
      await db.updateById('returnTrips', trip._id, { status: 'completed' });
      const driverShare = Math.round(bk.fare * 0.72);
      const ownerShare = Math.round(bk.fare * 0.23);
      const platformFee = bk.fare - driverShare - ownerShare;

      await db.insertOne('payments', {
        bookingId: booking._id,
        customerId: cust._id,
        driverId: drvEntry.driver._id,
        ownerId: veh.ownerId,
        amount: bk.fare,
        driverShare,
        ownerShare,
        platformFee,
        status: 'settled',
      });

      const currentDrv = await db.findById('drivers', drvEntry.driver._id);
      if (currentDrv) {
        await db.updateById('drivers', currentDrv._id, {
          totalEarnings: currentDrv.totalEarnings + driverShare,
        });
      }
      const currentOwner = await db.findById('vehicleOwners', veh.ownerId);
      if (currentOwner) {
        await db.updateById('vehicleOwners', currentOwner._id, {
          totalEarnings: currentOwner.totalEarnings + ownerShare,
        });
      }
      const currentCust = await db.findById('customers', cust._id);
      if (currentCust) {
        await db.updateById('customers', currentCust._id, {
          totalSpent: currentCust.totalSpent + bk.fare,
          totalBookings: currentCust.totalBookings + 1,
        });
      }

      await db.insertOne('reviews', {
        bookingId: booking._id,
        customerId: cust._id,
        driverId: drvEntry.driver._id,
        rating: 5,
        comment: `Smooth return-trip delivery by ${drvEntry.user.fullName} from ${trip.currentLocation} to ${trip.returnDestination}.`,
      });
    } else if (bk.status === 'In Transit' || bk.status === 'Confirmed') {
      await db.updateById('returnTrips', trip._id, {
        status: bk.status === 'In Transit' ? 'in_progress' : 'booked',
      });
      await db.updateById('vehicles', veh._id, { status: 'occupied' });
      const currentCust = await db.findById('customers', cust._id);
      if (currentCust) {
        await db.updateById('customers', currentCust._id, {
          totalBookings: currentCust.totalBookings + 1,
        });
      }
    }

    const progress =
      bk.status === 'Delivered' ? 100 : bk.status === 'In Transit' ? 55 : bk.status === 'Confirmed' ? 15 : 0;
    const midCoords = interpolateCoords(trip.currentCoords, trip.destinationCoords, progress / 100);

    await db.insertOne('tripTracking', {
      bookingId: booking._id,
      currentStatus: bk.status,
      currentLocationName:
        progress === 100
          ? trip.returnDestination
          : progress > 0
            ? `NH Corridor (${trip.currentLocation} → ${trip.returnDestination})`
            : trip.currentLocation,
      currentCoords: midCoords,
      progressPercent: progress,
      etaMinutes: Math.max(0, Math.round(trip.estimatedDurationMin * (1 - progress / 100))),
      isSimulated: true,
      history: [
        {
          status: 'Pending',
          locationName: trip.currentLocation,
          coords: trip.currentCoords,
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          note: `Booking ${bk.code} requested by ${custUser.fullName}.`,
        },
        ...(bk.status !== 'Pending'
          ? [
              {
                status: bk.status,
                locationName:
                  progress === 100 ? trip.returnDestination : `${trip.currentLocation} Corridor`,
                coords: midCoords,
                timestamp: new Date().toISOString(),
                note: `Shipment status updated to ${bk.status} (Simulated GPS telemetry).`,
              },
            ]
          : []),
      ],
    });
  }

  // 9. Welcome notifications for the 3 primary demo accounts
  await db.insertOne('notifications', {
    userId: drivers[0].user._id,
    title: 'Mysuru → Bengaluru Return Trip Active',
    message: 'Your 800 kg Tata Ace return trip on 20 Nov is live and ready for customer matching.',
    type: 'trip',
    relatedId: returnTrips[0]._id,
    isRead: false,
  });
  await db.insertOne('notifications', {
    userId: owners[0].user._id,
    title: 'Fleet Overview Ready',
    message: '4 vehicles registered under Kaveri Logistics Fleet. 3 drivers currently assigned.',
    type: 'vehicle',
    relatedId: owners[0].owner._id,
    isRead: false,
  });
  await db.insertOne('notifications', {
    userId: customers[0].user._id,
    title: 'Return-Trip Vehicles Available',
    message: 'Check Smart Matching results on Mysuru → Bengaluru or create a custom shipment request.',
    type: 'system',
    relatedId: shipments[0]._id,
    isRead: false,
  });

  console.log('[RouteBack Seed] Demo dataset seeded successfully.');
}
