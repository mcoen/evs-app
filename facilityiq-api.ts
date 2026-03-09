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

interface SourceLocation {
  floorName: string;
  zoneName: string;
  zoneCode: string;
  location: SnapshotLocation;
}

export interface FacilityIqEdPayload {
  revision: number;
  lastChangedAt: string;
  facilityName: string;
  facilityLocations: HospitalLocation[];
  edLocations: HospitalLocation[];
  rotationPath: string[];
}

export interface EvsAiHelperContext {
  facilityName: string;
  role: string;
  currentLocation: string;
  activeTaskTitle?: string;
  activeTaskRoom?: string;
  userLocations: string[];
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

function isEmergencyZoneLabel(zoneName: string, zoneCode: string): boolean {
  const normalized = `${zoneName} ${zoneCode}`.toLowerCase();
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

function extractSourceLocations(facility: SnapshotFacility): SourceLocation[] {
  const list: SourceLocation[] = [];

  for (const floor of facility.floors) {
    for (const zone of floor.zones) {
      for (const location of zone.locations) {
        list.push({
          floorName: floor.name,
          zoneName: zone.name,
          zoneCode: zone.code,
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

function dynamicGridCoordinate(index: number, total: number): { x: number; y: number } {
  if (total <= 1) {
    return { x: 100, y: 100 };
  }

  const columns = Math.max(4, Math.ceil(Math.sqrt(total)));
  const rows = Math.max(1, Math.ceil(total / columns));
  const column = index % columns;
  const row = Math.floor(index / columns);

  const width = 160;
  const height = 160;
  const xStep = columns > 1 ? width / (columns - 1) : 0;
  const yStep = rows > 1 ? height / (rows - 1) : 0;

  return {
    x: 20 + column * xStep,
    y: 20 + row * yStep
  };
}

function labelFor(location: SnapshotLocation, index: number): string {
  const room = location.room?.trim();
  if (room) {
    return `ED ${room}`;
  }

  const name = location.name?.trim();
  if (name) {
    return name.toLowerCase().startsWith("ed") ? name : `ED ${name}`;
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

  const allSourceLocations = extractSourceLocations(facility);
  const edSourceLocations = allSourceLocations.filter((entry) => isEmergencyZoneLabel(entry.zoneName, entry.zoneCode));
  if (!edSourceLocations.length) {
    throw new Error(`No ED locations found for ${facility.name}`);
  }

  const facilitySourceLocations = allSourceLocations.filter((entry) => !isEmergencyZoneLabel(entry.zoneName, entry.zoneCode));

  const facilityLocations: HospitalLocation[] = facilitySourceLocations.map((entry, index) => {
    const coordinate = dynamicGridCoordinate(index, facilitySourceLocations.length);
    return {
      id: entry.location.id,
      name: entry.location.name,
      x: coordinate.x,
      y: coordinate.y,
      locationType: entry.location.locationType,
      unit: entry.location.unit,
      zoneName: entry.zoneName,
      floorName: entry.floorName,
      sourceLocationId: entry.location.id,
      sourceLabel: entry.location.room ?? entry.location.name
    };
  });

  const edLocations: HospitalLocation[] = edSourceLocations.map((entry, index) => {
    const coordinate = dynamicCoordinate(index, edSourceLocations.length);
    return {
      id: `ED_BAY${index + 1}`,
      name: labelFor(entry.location, index),
      x: coordinate.x,
      y: coordinate.y,
      locationType: entry.location.locationType,
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
    facilityLocations,
    edLocations,
    rotationPath: edLocations.map((location) => location.id)
  };
}

export async function askEvsAiHelper(query: string, context: EvsAiHelperContext): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/ai/evs-helper`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      context
    })
  });

  if (!response.ok) {
    const fallback = `AI helper request failed (${response.status})`;
    let message = fallback;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      message = fallback;
    }
    throw new Error(message);
  }

  const payload = (await response.json()) as { response?: string };
  const text = payload.response?.trim();
  if (!text) {
    throw new Error("AI helper returned an empty response");
  }

  return text;
}
