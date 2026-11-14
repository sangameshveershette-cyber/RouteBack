import {
  calculateEstimatedFare,
  estimateRoadDistanceKm,
  haversineKm,
  type FareEstimateBreakdown,
} from './geoService.ts';
import type {
  DriverDoc,
  LatLng,
  ReturnTripDoc,
  UserDoc,
  VehicleDoc,
  VehicleType,
} from '../types.ts';

export interface ShipmentQuery {
  _id?: string;
  pickupLocation: string;
  deliveryLocation: string;
  pickupCoords: LatLng;
  deliveryCoords: LatLng;
  pickupDate: string;
  weightKg: number;
  preferredVehicleType?: string;
}

export interface RankedMatchResult {
  returnTrip: ReturnTripDoc;
  driver: DriverDoc;
  driverUser: Pick<UserDoc, '_id' | 'fullName' | 'mobile' | 'profilePhoto'>;
  vehicle: VehicleDoc;
  score: number;
  routeScore: number;
  capacityScore: number;
  timeScore: number;
  distanceScore: number;
  detourKm: number;
  shipmentDistanceKm: number;
  estimatedFare: number;
  fareBreakdown: FareEstimateBreakdown;
  explanation: string;
  calculationMethod: 'demo_corridor_estimate' | 'google_routes_api';
  rejectionReason?: string;
}

function pointToSegmentDistanceKm(p: LatLng, a: LatLng, b: LatLng): number {
  const ax = a.lng;
  const ay = a.lat;
  const bx = b.lng;
  const by = b.lat;
  const px = p.lng;
  const py = p.lat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return haversineKm(p, a);

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const proj: LatLng = { lat: ay + t * dy, lng: ax + t * dx };
  return haversineKm(p, proj);
}

function segmentProgress(p: LatLng, a: LatLng, b: LatLng): number {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  return ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / lenSq;
}

function dayDiff(dateA: string, dateB: string): number {
  const tA = Date.parse(dateA);
  const tB = Date.parse(dateB);
  if (Number.isNaN(tA) || Number.isNaN(tB)) return 99;
  return Math.round(Math.abs(tA - tB) / (1000 * 60 * 60 * 24));
}

function vehicleCategoryMatches(preferred: string | undefined, actual: VehicleType): boolean {
  if (!preferred || preferred === 'Any Suitable Vehicle' || preferred === 'Suitable small commercial vehicle') {
    return true;
  }
  if (preferred === actual) return true;
  const prefLower = preferred.toLowerCase();
  const actLower = actual.toLowerCase();
  if (prefLower.includes('small') || prefLower.includes('mini')) {
    return (
      actLower.includes('ace') ||
      actLower.includes('bolero') ||
      actLower.includes('dost') ||
      actLower.includes('407')
    );
  }
  if (prefLower.includes('medium') || prefLower.includes('14ft') || prefLower.includes('lcv')) {
    return actLower.includes('407') || actLower.includes('14ft') || actLower.includes('17ft');
  }
  if (prefLower.includes('heavy') || prefLower.includes('container')) {
    return actLower.includes('17ft') || actLower.includes('22ft') || actLower.includes('14ft');
  }
  return false;
}

export function evaluateTripMatch(
  shipment: ShipmentQuery,
  trip: ReturnTripDoc,
  driver: DriverDoc,
  driverUser: UserDoc,
  vehicle: VehicleDoc
): { suitable: boolean; result?: RankedMatchResult; reason?: string } {
  // 1. Hard eligibility filters
  if (trip.status !== 'open') {
    return { suitable: false, reason: 'Return trip is no longer open.' };
  }
  if (!trip.ownerApproved) {
    return { suitable: false, reason: 'Vehicle owner approval pending for trip.' };
  }
  if (trip.availableCapacityKg < shipment.weightKg) {
    return {
      suitable: false,
      reason: `Insufficient capacity (${trip.availableCapacityKg} kg available vs ${shipment.weightKg} kg required).`,
    };
  }

  // 2. Date compatibility check (reject > 3 days apart)
  const diffDays = dayDiff(shipment.pickupDate, trip.departureDate);
  if (diffDays > 3) {
    return {
      suitable: false,
      reason: `Departure date ${trip.departureDate} is ${diffDays} days away from pickup date ${shipment.pickupDate}.`,
    };
  }

  // 3. Directional & Corridor compatibility check
  const pickupProg = segmentProgress(
    shipment.pickupCoords,
    trip.currentCoords,
    trip.destinationCoords
  );
  const deliveryProg = segmentProgress(
    shipment.deliveryCoords,
    trip.currentCoords,
    trip.destinationCoords
  );

  // Reject if shipment goes opposite to the driver's return direction
  if (deliveryProg < pickupProg - 0.12) {
    return {
      suitable: false,
      reason: 'Shipment direction opposes the driver return route.',
    };
  }

  const pickupCorridorDist = pointToSegmentDistanceKm(
    shipment.pickupCoords,
    trip.currentCoords,
    trip.destinationCoords
  );
  const deliveryCorridorDist = pointToSegmentDistanceKm(
    shipment.deliveryCoords,
    trip.currentCoords,
    trip.destinationCoords
  );

  if (pickupCorridorDist > 75 || deliveryCorridorDist > 75) {
    return {
      suitable: false,
      reason: 'Pickup or delivery is outside the maximum 75 km highway corridor radius.',
    };
  }

  // 4. Detour calculation
  const baseTripKm = Math.max(
    10,
    trip.distanceKm || estimateRoadDistanceKm(trip.currentCoords, trip.destinationCoords)
  );
  const leg1 = estimateRoadDistanceKm(trip.currentCoords, shipment.pickupCoords);
  const shipmentDist = estimateRoadDistanceKm(shipment.pickupCoords, shipment.deliveryCoords);
  const leg3 = estimateRoadDistanceKm(shipment.deliveryCoords, trip.destinationCoords);
  const combinedKm = leg1 + shipmentDist + leg3;
  const detourKm = Math.max(0, Math.round(combinedKm - baseTripKm));

  // Reject excessive detour (> 120 km or > 45% of base return route)
  if (detourKm > Math.max(120, Math.round(baseTripKm * 0.45))) {
    return {
      suitable: false,
      reason: `Excessive route detour (${detourKm} km extra).`,
    };
  }

  // --- Weighted Scoring (Total 100) ---
  // A. Route Compatibility (40 points)
  const startMatchKm = haversineKm(trip.currentCoords, shipment.pickupCoords);
  const endMatchKm = haversineKm(trip.destinationCoords, shipment.deliveryCoords);
  const corridorPenalty = (pickupCorridorDist + deliveryCorridorDist) * 0.45;
  const endpointBonus =
    (startMatchKm < 25 ? 8 : startMatchKm < 60 ? 4 : 0) +
    (endMatchKm < 25 ? 8 : endMatchKm < 60 ? 4 : 0);
  const typeMatched = vehicleCategoryMatches(shipment.preferredVehicleType, trip.vehicleType);
  const typeBonus = typeMatched ? 4 : -6;
  const rawRouteScore = 20 + endpointBonus + typeBonus - corridorPenalty;
  const routeScore = Math.max(0, Math.min(40, Math.round(rawRouteScore)));

  // B. Capacity Compatibility (25 points)
  const utilization = shipment.weightKg / trip.availableCapacityKg;
  // Optimal fit between 30% and 95% utilization
  let capacityRatio = 0.7;
  if (utilization >= 0.35 && utilization <= 0.95) {
    capacityRatio = 1.0;
  } else if (utilization > 0.95) {
    capacityRatio = 0.92;
  } else {
    capacityRatio = 0.6 + utilization;
  }
  const capacityScore = Math.max(0, Math.min(25, Math.round(capacityRatio * 25)));

  // C. Time Compatibility (20 points)
  const timeWeights: Record<number, number> = { 0: 20, 1: 14, 2: 8, 3: 4 };
  const timeScore = timeWeights[diffDays] ?? 0;

  // D. Distance Deviation (15 points)
  const detourPenaltyRatio = Math.min(1, detourKm / Math.max(40, baseTripKm * 0.35));
  const distanceScore = Math.max(0, Math.min(15, Math.round((1 - detourPenaltyRatio) * 15)));

  const totalScore = Math.max(0, Math.min(100, routeScore + capacityScore + timeScore + distanceScore));

  if (totalScore < 45) {
    return { suitable: false, reason: `Weighted compatibility score (${totalScore}/100) below threshold.` };
  }

  const fareBreakdown = calculateEstimatedFare({
    distanceKm: shipmentDist,
    weightKg: shipment.weightKg,
    vehicleType: trip.vehicleType,
    detourKm,
    driverExpectedPrice: trip.expectedPrice,
  });

  const explanationParts: string[] = [];
  if (startMatchKm < 25 && endMatchKm < 25) {
    explanationParts.push(
      `Direct corridor match (${trip.currentLocation} to ${trip.returnDestination})`
    );
  } else {
    explanationParts.push(
      `Along-route corridor match on ${trip.currentLocation} to ${trip.returnDestination} (+${detourKm} km deviation)`
    );
  }
  explanationParts.push(
    `${shipment.weightKg} kg cargo fits ${trip.availableCapacityKg} kg available space (${Math.round(utilization * 100)}% load utilization)`
  );
  if (diffDays === 0) {
    explanationParts.push(`Exact date match on ${trip.departureDate} at ${trip.departureTime}`);
  } else {
    explanationParts.push(`Departs ${trip.departureDate} (${diffDays}d from requested pickup)`);
  }
  if (!typeMatched && shipment.preferredVehicleType && shipment.preferredVehicleType !== 'Any Suitable Vehicle') {
    explanationParts.push(
      `Note: Vehicle is ${trip.vehicleType} (requested ${shipment.preferredVehicleType})`
    );
  }

  return {
    suitable: true,
    result: {
      returnTrip: trip,
      driver,
      driverUser: {
        _id: driverUser._id,
        fullName: driverUser.fullName,
        mobile: driverUser.mobile,
        profilePhoto: driverUser.profilePhoto,
      },
      vehicle,
      score: totalScore,
      routeScore,
      capacityScore,
      timeScore,
      distanceScore,
      detourKm,
      shipmentDistanceKm: shipmentDist,
      estimatedFare: fareBreakdown.estimatedTotalFare,
      fareBreakdown,
      explanation: explanationParts.join('. ') + '.',
      calculationMethod: 'demo_corridor_estimate',
    },
  };
}
