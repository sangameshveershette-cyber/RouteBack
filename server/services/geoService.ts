import type { LatLng, VehicleType } from '../types.ts';

export interface CityInfo {
  name: string;
  state: string;
  coords: LatLng;
}

export const INDIAN_CITIES: CityInfo[] = [
  { name: 'Bengaluru', state: 'Karnataka', coords: { lat: 12.9716, lng: 77.5946 } },
  { name: 'Mysuru', state: 'Karnataka', coords: { lat: 12.2958, lng: 76.6394 } },
  { name: 'Tumakuru', state: 'Karnataka', coords: { lat: 13.3379, lng: 77.1173 } },
  { name: 'Chennai', state: 'Tamil Nadu', coords: { lat: 13.0827, lng: 80.2707 } },
  { name: 'Hyderabad', state: 'Telangana', coords: { lat: 17.385, lng: 78.4867 } },
  { name: 'Pune', state: 'Maharashtra', coords: { lat: 18.5204, lng: 73.8567 } },
  { name: 'Mangaluru', state: 'Karnataka', coords: { lat: 12.9141, lng: 74.856 } },
  { name: 'Mandya', state: 'Karnataka', coords: { lat: 12.5218, lng: 76.8951 } },
  { name: 'Ramanagara', state: 'Karnataka', coords: { lat: 12.715, lng: 77.281 } },
  { name: 'Hosur', state: 'Tamil Nadu', coords: { lat: 12.7409, lng: 77.8253 } },
  { name: 'Vellore', state: 'Tamil Nadu', coords: { lat: 12.9165, lng: 79.1325 } },
  { name: 'Krishnagiri', state: 'Tamil Nadu', coords: { lat: 12.5186, lng: 78.2137 } },
  { name: 'Hassan', state: 'Karnataka', coords: { lat: 13.0033, lng: 76.1004 } },
  { name: 'Davanagere', state: 'Karnataka', coords: { lat: 14.4644, lng: 75.9218 } },
  { name: 'Hubballi', state: 'Karnataka', coords: { lat: 15.3647, lng: 75.124 } },
  { name: 'Belagavi', state: 'Karnataka', coords: { lat: 15.8497, lng: 74.4977 } },
  { name: 'Kolhapur', state: 'Maharashtra', coords: { lat: 16.705, lng: 74.2433 } },
  { name: 'Satara', state: 'Maharashtra', coords: { lat: 17.6805, lng: 74.0183 } },
  { name: 'Anantapur', state: 'Andhra Pradesh', coords: { lat: 14.6819, lng: 77.6006 } },
  { name: 'Kurnool', state: 'Andhra Pradesh', coords: { lat: 15.8281, lng: 78.0373 } },
  { name: 'Chitradurga', state: 'Karnataka', coords: { lat: 14.2251, lng: 76.398 } },
  { name: 'Mumbai', state: 'Maharashtra', coords: { lat: 19.076, lng: 72.8777 } },
];

const CITY_ALIASES: Record<string, string> = {
  bangalore: 'Bengaluru',
  mysore: 'Mysuru',
  tumkur: 'Tumakuru',
  mangalore: 'Mangaluru',
  hubli: 'Hubballi',
  belgaum: 'Belagavi',
  madras: 'Chennai',
};

export function resolveLocationCoords(locationName: string, providedCoords?: LatLng): LatLng {
  if (
    providedCoords &&
    Number.isFinite(providedCoords.lat) &&
    Number.isFinite(providedCoords.lng) &&
    (providedCoords.lat !== 0 || providedCoords.lng !== 0)
  ) {
    return providedCoords;
  }

  const normalized = locationName.trim().toLowerCase();
  for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
    if (normalized.includes(alias)) {
      const city = INDIAN_CITIES.find((c) => c.name === canonical);
      if (city) return city.coords;
    }
  }

  for (const city of INDIAN_CITIES) {
    if (normalized.includes(city.name.toLowerCase())) {
      return city.coords;
    }
  }

  // Deterministic pseudo-coordinate inside South/West India corridor for unrecognized locality strings
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) % 10000;
  }
  const lat = 12.4 + (hash % 550) / 100;
  const lng = 74.8 + ((hash >> 3) % 520) / 100;
  return { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) };
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function estimateRoadDistanceKm(a: LatLng, b: LatLng): number {
  const straight = haversineKm(a, b);
  if (straight < 1) return 2;
  // Standard highway tortuosity factor for Indian NH corridors
  return Math.round(straight * 1.22);
}

export function estimateTravelDurationMin(distanceKm: number): number {
  // Average commercial freight highway speed ~48 km/h including tolls & city entry
  return Math.max(25, Math.round((distanceKm / 48) * 60));
}

export function interpolateCoords(a: LatLng, b: LatLng, progress01: number): LatLng {
  const t = Math.max(0, Math.min(1, progress01));
  return {
    lat: Number((a.lat + (b.lat - a.lat) * t).toFixed(5)),
    lng: Number((a.lng + (b.lng - a.lng) * t).toFixed(5)),
  };
}

export const VEHICLE_RATE_CONFIG: Record<
  VehicleType,
  { baseFare: number; perKmRate: number; fuelKmPerL: number; typicalCapacityKg: number }
> = {
  'Tata Ace (Mini Truck)': {
    baseFare: 450,
    perKmRate: 14,
    fuelKmPerL: 14,
    typicalCapacityKg: 850,
  },
  'Mahindra Bolero Pickup': {
    baseFare: 550,
    perKmRate: 16,
    fuelKmPerL: 12.5,
    typicalCapacityKg: 1250,
  },
  'Ashok Leyland Dost': {
    baseFare: 600,
    perKmRate: 17,
    fuelKmPerL: 12,
    typicalCapacityKg: 1500,
  },
  'Tata 407 (LCV)': {
    baseFare: 850,
    perKmRate: 21,
    fuelKmPerL: 9.5,
    typicalCapacityKg: 2500,
  },
  'Eicher Pro 14ft': {
    baseFare: 1200,
    perKmRate: 26,
    fuelKmPerL: 7.2,
    typicalCapacityKg: 4500,
  },
  'BharatBenz 17ft Container': {
    baseFare: 1550,
    perKmRate: 31,
    fuelKmPerL: 5.8,
    typicalCapacityKg: 7000,
  },
  'Heavy Duty 22ft Truck': {
    baseFare: 2100,
    perKmRate: 38,
    fuelKmPerL: 4.5,
    typicalCapacityKg: 12000,
  },
};

export interface FareEstimateBreakdown {
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

export function calculateEstimatedFare(params: {
  distanceKm: number;
  weightKg: number;
  vehicleType: VehicleType;
  detourKm: number;
  driverExpectedPrice?: number;
}): FareEstimateBreakdown {
  const cfg =
    VEHICLE_RATE_CONFIG[params.vehicleType] || VEHICLE_RATE_CONFIG['Tata Ace (Mini Truck)'];
  const dieselPricePerLitre = 90;

  // Return-trip discount factor (approx 32% lower than dedicated empty-return charter rate)
  const returnDiscountFactor = 0.68;
  const baseComponent = Math.round(cfg.baseFare * returnDiscountFactor);
  const distanceComponent = Math.round(params.distanceKm * cfg.perKmRate * returnDiscountFactor);
  const weightSurcharge = Math.round(Math.max(0, params.weightKg - 250) * 0.45);
  const detourFuelLitres = params.detourKm / cfg.fuelKmPerL;
  const detourFuelSurcharge = Math.round(detourFuelLitres * dieselPricePerLitre * 1.25);

  const totalFuelLitres = (params.distanceKm + params.detourKm) / cfg.fuelKmPerL;
  const estimatedFuelCost = Math.round(totalFuelLitres * dieselPricePerLitre);

  const algorithmicFare =
    baseComponent + distanceComponent + weightSurcharge + detourFuelSurcharge;

  const driverExpectedFare =
    params.driverExpectedPrice && params.driverExpectedPrice > 0
      ? Math.round(params.driverExpectedPrice)
      : algorithmicFare;

  // Blend algorithmic distance/weight estimate with driver's requested return-trip fare
  const estimatedTotalFare =
    params.driverExpectedPrice && params.driverExpectedPrice > 0
      ? Math.round(algorithmicFare * 0.45 + driverExpectedFare * 0.55)
      : algorithmicFare;

  return {
    baseComponent,
    distanceComponent,
    weightSurcharge,
    detourFuelSurcharge,
    estimatedFuelCost,
    driverExpectedFare,
    estimatedTotalFare,
    dieselPricePerLitre,
    disclaimer:
      'Indicative return-trip estimate based on distance, cargo weight, vehicle class, detour fuel cost, and driver requested fare. Actual settlement is confirmed upon booking.',
  };
}
