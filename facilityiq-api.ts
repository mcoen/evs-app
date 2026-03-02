import { HospitalLocation } from "./types";

interface SnapshotLocation {
  id: string;
  name: string;
  locationType: "room" | "bed" | "hallway" | "nurse_station" | "procedure_area" | "other";
  unit: string;
  room?: string;
}

interface SnapshotZone {
  id: string;
  name: string;
  code: string;
  locations: SnapshotLocation[];
}

interface SnapshotFloor {
  id: string;
  name: string;
  level: string;
  zones: SnapshotZone[];
}

interface SnapshotFacility {
  id: string;
  name: string;
  floors: SnapshotFloor[];
}

interface SnapshotResponse {
  revision: number;
  lastChangedAt: string;
  facilities: SnapshotFacility[];
}

interface EdSourceLocation {
  floorName: string;
  zoneName: string;
  location: SnapshotLocation;
}

export interface FacilityIqEdPayload {
  revision: number;
  lastChangedAt: string;
  facilityName: string;
  edLocations: HospitalLocation[];
  rotationPath: string[];
}

const API_BASE_URL = (import.meta.env?.VITE_FACILITYIQ_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
const FACILITY_NAME_FILTER = (import.meta.env?.VITE_FACILITYIQ_FACILITY_NAME ?? "").trim().toLowerCase();

const STATIC_BAY_COORDINATES: Array<{ x: number; y: number }> = [
  { x: 40, y: 40 },
  { x: 70, y: 40 },
  { x: 100, y: 40 },
  { x: 130, y: 40 },
  { x: 160, y: 40 },
  { x: 160, y: 80 },
  { x: 130, y: 80 },
  { x: 100, y: 80 },
  { x: 70, y: 80 },
  { x: 40, y: 80 }
];

function isEmergencyZone(zone: SnapshotZone): boolean {
  const normalized = `${zone.name} ${zone.code}`.toLowerCase();
  return normalized.includes("emergency") || normalized.includes(" ed") || normalized.endsWith("ed");
}

function selectFacility(facilities: SnapshotFacility[]): SnapshotFacility | undefined {
  const withEd = facilities.filter((facility) =>
    facility.floors.some((floor) => floor.zones.some((zone) => isEmergencyZone(zone) && zone.locations.length > 0))
  );

  if (!withEd.length) {
    return facilities[0];
  }

  if (!FACILITY_NAME_FILTER) {
    return withEd[0];
  }

  return withEd.find((facility) => facility.name.toLowerCase().includes(FACILITY_NAME_FILTER)) ?? withEd[0];
}

function extractEdLocations(facility: SnapshotFacility): EdSourceLocation[] {
  const list: EdSourceLocation[] = [];

  for (const floor of facility.floors) {
    for (const zone of floor.zones) {
      if (!isEmergencyZone(zone)) {
        continue;
      }

      for (const location of zone.locations) {
        list.push({
          floorName: floor.name,
          zoneName: zone.name,
          location
        });
      }
    }
  }

  return list.sort((a, b) => {
    const left = a.location.room ?? a.location.name;
    const right = b.location.room ?? b.location.name;
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
  });
}

function dynamicCoordinate(index: number, total: number): { x: number; y: number } {
  if (index < STATIC_BAY_COORDINATES.length) {
    return STATIC_BAY_COORDINATES[index];
  }

  const columns = 5;
  const row = Math.floor(index / columns);
  const col = index % columns;
  const x = 30 + col * 33;
  const y = 40 + row * 28;
  return { x, y };
}

function labelFor(location: SnapshotLocation, index: number): string {
  if (location.room?.trim()) {
    return `ED ${location.room.trim()}`;
  }

  if (location.name.toLowerCase().startsWith("ed")) {
    return location.name;
  }

  return `ED Bay ${index + 1}`;
}

export async function fetchFacilityIqEdPayload(signal?: AbortSignal): Promise<FacilityIqEdPayload> {
  const response = await fetch(`${API_BASE_URL}/api/snapshot`, { signal });
  if (!response.ok) {
    throw new Error(`Facility IQ API returned ${response.status}`);
  }

  const payload = (await response.json()) as SnapshotResponse;
  if (!payload.facilities?.length) {
    throw new Error("No facilities found in snapshot");
  }

  const facility = selectFacility(payload.facilities);
  if (!facility) {
    throw new Error("Unable to select facility from snapshot");
  }

  const edSourceLocations = extractEdLocations(facility);
  if (!edSourceLocations.length) {
    throw new Error(`No ED locations found for ${facility.name}`);
  }

  const edLocations: HospitalLocation[] = edSourceLocations.map((entry, index) => {
    const coordinate = dynamicCoordinate(index, edSourceLocations.length);
    return {
      id: `ED_BAY${index + 1}`,
      name: labelFor(entry.location, index),
      x: coordinate.x,
      y: coordinate.y,
      unit: entry.location.unit,
      zoneName: entry.zoneName,
      floorName: entry.floorName,
      sourceLocationId: entry.location.id,
      sourceLabel: entry.location.room ?? entry.location.name
    };
  });

  return {
    revision: payload.revision,
    lastChangedAt: payload.lastChangedAt,
    facilityName: facility.name,
    edLocations,
    rotationPath: edLocations.map((location) => location.id)
  };
}
