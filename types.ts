
export enum EmployeeRole {
  EVS = 'Environmental Services',
  ENGINEERING = 'Engineering',
  BIOMED = 'BioMed',
  TRANSPORTER = 'Transporter',
  ED_EVS = 'ED EVS'
}

export enum TaskStatus {
  PENDING = 'Pending',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  ON_BREAK = 'On Break'
}

export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export enum AssetStatus {
  IN_SERVICE = 'In Service',
  OUT_OF_SERVICE = 'Out of Service'
}

export interface ManualSection {
  heading: string;
  content: string;
}

export interface TaskNote {
  id: string;
  text: string;
  timestamp: string;
  photo?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  locationId: string;
  roomNumber: string;
  role: EmployeeRole;
  priority: TaskPriority;
  estimatedMinutes: number;
  actualMinutes: number;
  status: TaskStatus;
  checkList: string[];
  serviceManualTitle?: string;
  serviceManualSections?: ManualSection[];
  serviceManualDownloadUrl?: string;
  serviceManualImageUrl?: string;
  notes?: TaskNote[];
  completionTimestamp?: string;
  // Asset Management Fields
  isAssetTask?: boolean;
  assetId?: string;
  assetStatus?: AssetStatus;
  assetReplacementId?: string;
  pullReason?: string;
}

export interface User {
  id: string;
  name: string;
  role: EmployeeRole;
  employeeId: string;
  avatar?: string;
}

export interface HospitalLocation {
  id: string;
  name: string;
  x: number;
  y: number;
  unit?: string;
  zoneName?: string;
  floorName?: string;
  sourceLocationId?: string;
  sourceLabel?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'warning' | 'critical';
}
