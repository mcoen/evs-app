
import { EmployeeRole, Task, TaskPriority, TaskStatus, HospitalLocation, AppNotification, AssetStatus, User } from './types';

export const LOCATIONS: HospitalLocation[] = [
  { id: '101', name: 'Room 101', x: 20, y: 30 },
  { id: '102', name: 'Room 102', x: 20, y: 60 },
  { id: '103', name: 'Room 103', x: 20, y: 90 },
  { id: '104', name: 'Room 104', x: 180, y: 30 },
  { id: '105', name: 'Room 105', x: 180, y: 60 },
  { id: '106', name: 'Room 106', x: 180, y: 90 },
  { id: 'OR4', name: 'OR 4', x: 60, y: 15 },
  { id: 'STATION', name: 'Nursing Station', x: 100, y: 60 },
  { id: 'SUPPLY', name: 'Supply Closet', x: 100, y: 15 },
  { id: 'BREAK', name: 'Staff Lounge', x: 100, y: 105 },
  { id: 'ED_BAY1', name: 'ED Bay 1', x: 40, y: 40 },
  { id: 'ED_BAY2', name: 'ED Bay 2', x: 70, y: 40 },
  { id: 'ED_BAY3', name: 'ED Bay 3', x: 100, y: 40 },
  { id: 'ED_BAY4', name: 'ED Bay 4', x: 130, y: 40 },
  { id: 'ED_BAY5', name: 'ED Bay 5', x: 160, y: 40 },
  { id: 'ED_BAY6', name: 'ED Bay 6', x: 160, y: 80 },
  { id: 'ED_BAY7', name: 'ED Bay 7', x: 130, y: 80 },
  { id: 'ED_BAY8', name: 'ED Bay 8', x: 100, y: 80 },
  { id: 'ED_BAY9', name: 'ED Bay 9', x: 70, y: 80 },
  { id: 'ED_BAY10', name: 'ED Bay 10', x: 40, y: 80 },
];

export const ROTATIONAL_PATH = [
  'ED_BAY1', 'ED_BAY2', 'ED_BAY3', 'ED_BAY4', 'ED_BAY5', 
  'ED_BAY6', 'ED_BAY7', 'ED_BAY8', 'ED_BAY9', 'ED_BAY10'
];

export const ROTATIONAL_PROTOCOL = [
  'Sanitize high-touch surfaces',
  'Empty waste and linen bins',
  'Check supply levels (gloves, wipes)',
  'Spot mop floor if needed',
  'Verify equipment placement'
];

export const TERMINAL_ED_PROTOCOL = [
  'Full room disinfection (Sporicidal)',
  'Strip and remake stretcher',
  'Deep clean all medical equipment',
  'Wall-to-wall floor disinfection',
  'UV Light cycle (if required)',
  'Final inspection and sign-off'
];

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    title: 'Stat Cleaning Required',
    message: 'Biohazard spill reported in West Wing Corridor. Proximity alert.',
    time: '2m ago',
    read: false,
    type: 'critical'
  },
  {
    id: 'n4',
    title: 'Linen Shortage Alert',
    message: 'Unit 4 is reporting low inventory of fitted sheets. Please restock when current task ends.',
    time: '8m ago',
    read: false,
    type: 'warning'
  },
  {
    id: 'n5',
    title: 'Patient Transport Delay',
    message: 'Room 102 discharge is delayed. Expect task update in 15 minutes.',
    time: '12m ago',
    read: false,
    type: 'info'
  },
  {
    id: 'n6',
    title: 'Supplies Delivered',
    message: 'New shipment of hospital-grade disinfectant arrived at the main dock.',
    time: '25m ago',
    read: false,
    type: 'info'
  },
  {
    id: 'n2',
    title: 'Shift Update',
    message: 'Your shift has been extended by 30 minutes due to high census.',
    time: '1h ago',
    read: true,
    type: 'warning'
  }
];

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Nelson Hernandez',
    role: EmployeeRole.EVS,
    employeeId: 'EVS-88291',
  },
  {
    id: 'u2',
    name: 'Sarah Jenkins',
    role: EmployeeRole.TRANSPORTER,
    employeeId: 'TRN-44210',
  },
  {
    id: 'u3',
    name: 'Mike Chen',
    role: EmployeeRole.ENGINEERING,
    employeeId: 'ENG-11029',
  },
  {
    id: 'u4',
    name: 'Elena Rodriguez',
    role: EmployeeRole.BIOMED,
    employeeId: 'BMD-77382',
  },
  {
    id: 'u5',
    name: 'David Miller',
    role: EmployeeRole.ED_EVS,
    employeeId: 'ED-EVS-12345',
  }
];

export const MOCK_TASKS: Task[] = [
  {
    id: 't7',
    title: 'OR Terminal Decontamination',
    description: 'Comprehensive terminal clean of Operating Room 4 after surgical schedule completion. Requires specialized OR PPE.',
    locationId: 'OR4',
    roomNumber: 'OR 4',
    role: EmployeeRole.EVS,
    priority: TaskPriority.CRITICAL,
    estimatedMinutes: 75,
    actualMinutes: 0,
    status: TaskStatus.IN_PROGRESS,
    checkList: [
      'PPE: Don specialized OR attire, shoe covers, and hair cover',
      'Lights: Disinfect surgical lights and ceiling-mounted tracks (Top-Down)',
      'Anesthesia: Deep clean anesthesia machines and gas lead lines',
      'Table: Full decontamination of OR table pads, rails, and base mechanics',
      'Fixed Assets: Wipe down all wall-mounted monitors and cabinetry',
      'Mobile Equip: Sanitize cautery units, laser machines, and IV poles',
      'Floor: Perimeter-to-center wet mop with Phenolic disinfectant',
      'Waste: Remove biohazard bins and sharps containers; reline buckets',
      'Quality Control: Perform ATP bioluminescence swab test on 5 high-touch sites'
    ],
    serviceManualTitle: 'HCA Operating Room Cleaning Standards (AORN Compliant)',
    serviceManualSections: [
      {
        heading: 'Decontamination Order of Operations',
        content: 'Cleaning must always proceed from cleanest areas to dirtiest areas, and from high surfaces to low surfaces. The surgical table is considered the center of the zone and requires the most intensive chemical contact time (minimum 4 minutes).'
      },
      {
        heading: 'Chemical Selection',
        content: 'Use hospital-grade EPA-registered sporicidal disinfectant. For C-Diff or high-risk cases, use Bleach-based solutions (1:10 dilution). Ensure no chemical residue remains on surgical light lenses.'
      }
    ],
    notes: []
  },
  {
    id: 't1',
    title: 'Terminal Clean',
    description: 'Patient discharge. Full room disinfection required.',
    locationId: '101',
    roomNumber: '101',
    role: EmployeeRole.EVS,
    priority: TaskPriority.HIGH,
    estimatedMinutes: 45,
    actualMinutes: 0,
    status: TaskStatus.PENDING,
    checkList: [
      'AIDET Acknowledge & Introduce',
      'Remove all soiled linen',
      'High dust all horizontal surfaces',
      'Disinfect patient bed (Blue rag)',
      'Clean high touch areas',
      'Disinfect restroom',
      'Wet mop floor',
      'Final maintenance check'
    ],
    notes: []
  },
  {
    id: 't5',
    title: 'Daily Patient Room Clean',
    description: 'Standard daily maintenance cleaning while patient is present.',
    locationId: '102',
    roomNumber: '102',
    role: EmployeeRole.EVS,
    priority: TaskPriority.MEDIUM,
    estimatedMinutes: 20,
    actualMinutes: 0,
    status: TaskStatus.PENDING,
    checkList: [
      'Knock and announce entry',
      'Empty trash and linen',
      'Dust high-touch surfaces',
      'Clean and sanitize bathroom',
      'Damp mop floor',
      'Ask patient if anything else is needed'
    ],
    notes: []
  },
  {
    id: 't6',
    title: 'Patient Transport to Radiology',
    description: 'Move patient from Room 103 to Radiology for MRI.',
    locationId: '103',
    roomNumber: '103',
    role: EmployeeRole.TRANSPORTER,
    priority: TaskPriority.HIGH,
    estimatedMinutes: 15,
    actualMinutes: 0,
    status: TaskStatus.PENDING,
    checkList: [
      'Verify Patient ID (2-step check)',
      'Transfer patient to wheelchair/stretcher',
      'Ensure O2 tank/IV pump secure',
      'Transport to Radiology Dept',
      'Hand-off to receiving nurse'
    ],
    notes: []
  },
  {
    id: 't8',
    title: 'Discharge Transport',
    description: 'Transport patient from Room 101 to Main Entrance for discharge.',
    locationId: '101',
    roomNumber: '101',
    role: EmployeeRole.TRANSPORTER,
    priority: TaskPriority.MEDIUM,
    estimatedMinutes: 10,
    actualMinutes: 0,
    status: TaskStatus.PENDING,
    checkList: [
      'Verify Patient ID',
      'Confirm discharge orders with nurse',
      'Assist patient to wheelchair',
      'Transport to Main Entrance',
      'Verify family/transport is present'
    ],
    notes: []
  },
  {
    id: 't4',
    title: 'Defective Pump Replacement',
    description: 'Replace defective infusion pump reported in Room 105.',
    locationId: '105',
    roomNumber: '105',
    role: EmployeeRole.BIOMED,
    priority: TaskPriority.CRITICAL,
    estimatedMinutes: 15,
    actualMinutes: 0,
    status: TaskStatus.PENDING,
    isAssetTask: true,
    assetId: 'AL-8100-9942',
    assetStatus: AssetStatus.IN_SERVICE,
    checkList: [
      'Locate defective unit',
      'Verify serial number AL-8100-9942',
      'Transition unit to Out of Service',
      'Install replacement unit',
      'Verify patient safety parameters'
    ],
    notes: []
  },
  {
    id: 't9',
    title: 'Ventilator Preventative Maintenance',
    description: 'Scheduled 6-month PM for Puritan Bennett 980.',
    locationId: 'STATION',
    roomNumber: 'ICU Storage',
    role: EmployeeRole.BIOMED,
    priority: TaskPriority.MEDIUM,
    estimatedMinutes: 60,
    actualMinutes: 0,
    status: TaskStatus.PENDING,
    checkList: [
      'Visual inspection of chassis and power cord',
      'Battery capacity test',
      'Oxygen sensor calibration',
      'Flow sensor verification',
      'Update PM sticker'
    ],
    notes: []
  },
  {
    id: 't2',
    title: 'HVAC Temperature Check',
    description: 'Patient reported room 104 is too cold.',
    locationId: '104',
    roomNumber: '104',
    role: EmployeeRole.ENGINEERING,
    priority: TaskPriority.MEDIUM,
    estimatedMinutes: 20,
    actualMinutes: 0,
    status: TaskStatus.PENDING,
    checkList: [
      'Check thermostat calibration',
      'Inspect air vents for obstruction',
      'Verify HVAC unit operation',
      'Update status to Ready'
    ],
    serviceManualTitle: 'Trane Horizon® HVAC Unit Service Guide',
    serviceManualDownloadUrl: 'https://www.michaelcoen.com/docs/TraneManual.pdf',
    serviceManualImageUrl: 'https://www.michaelcoen.com/images/TraneDiagram.png',
    serviceManualSections: [
      {
        heading: 'System Overview & Thorough Specifications',
        content: 'The Trane Horizon unit is a specialized Dedicated Outdoor Air System (DOAS), engineered for rigorous clinical environments. It employs a high-efficiency variable frequency drive (VFD) paired with a direct-drive plenum fan assembly. Technical specs include: 460V/3-Phase/60Hz input, factory-charged R-410A (12.5 lbs), and a 5.0 Ton nominal capacity.'
      },
      {
        heading: 'Thermostat & VAV Field Calibration',
        content: 'All zone control is managed via a standard 0-10V DC analog signal. For onsite calibration: 1) Simultaneously depress and hold UP and DOWN arrows on the room sensor for 5 seconds. 2) Enter Service Code 8829.'
      }
    ],
    notes: []
  },
  {
    id: 't10',
    title: 'Emergency Generator Load Test',
    description: 'Weekly scheduled load test for Generator A.',
    locationId: 'SUPPLY',
    roomNumber: 'Mech Room B1',
    role: EmployeeRole.ENGINEERING,
    priority: TaskPriority.HIGH,
    estimatedMinutes: 45,
    actualMinutes: 0,
    status: TaskStatus.PENDING,
    checkList: [
      'Check fuel levels',
      'Inspect coolant and oil levels',
      'Initiate load transfer',
      'Monitor exhaust temperature',
      'Log run time and performance data'
    ],
    notes: []
  },
  {
    id: 't3',
    title: 'Infusion Pump Maintenance',
    description: 'Scheduled calibration for Alaris pump.',
    locationId: 'STATION',
    roomNumber: 'Nursing Station',
    role: EmployeeRole.BIOMED,
    priority: TaskPriority.MEDIUM,
    estimatedMinutes: 30,
    actualMinutes: 0,
    status: TaskStatus.PENDING,
    checkList: [
      'Verify serial number',
      'Battery performance test',
      'Calibrate flow rate sensors',
      'Apply new certification sticker'
    ],
    serviceManualTitle: 'Alaris™ Pump Module Model 8100 Service Manual',
    serviceManualSections: [
      {
        heading: 'Flow Calibration & Precision Standards',
        content: 'Use a Fluke IDA-5 Infusion Device Analyzer for all calibration procedures. Flow accuracy must be +/- 5.0% for rates between 1-999 mL/h.'
      }
    ],
    notes: []
  },
  {
    id: 'ed_r1',
    title: 'Rotational Clean - Bay 1',
    description: 'Standard rotational maintenance clean of the Emergency Department.',
    locationId: 'ED_BAY1',
    roomNumber: 'Bay 1',
    role: EmployeeRole.ED_EVS,
    priority: TaskPriority.LOW,
    estimatedMinutes: 10,
    actualMinutes: 0,
    status: TaskStatus.PENDING,
    checkList: ROTATIONAL_PROTOCOL,
    notes: []
  },
  {
    id: 'ed_t1',
    title: 'Stat Terminal Clean - Bay 5',
    description: 'Immediate terminal clean required after high-risk discharge.',
    locationId: 'ED_BAY5',
    roomNumber: 'Bay 5',
    role: EmployeeRole.ED_EVS,
    priority: TaskPriority.CRITICAL,
    estimatedMinutes: 35,
    actualMinutes: 0,
    status: TaskStatus.PENDING,
    checkList: TERMINAL_ED_PROTOCOL,
    notes: []
  },
  {
    id: 'ed_s1',
    title: 'Biohazard Spill Response',
    description: 'Blood spill reported near Bay 8.',
    locationId: 'ED_BAY8',
    roomNumber: 'Bay 8 Corridor',
    role: EmployeeRole.ED_EVS,
    priority: TaskPriority.HIGH,
    estimatedMinutes: 15,
    actualMinutes: 0,
    status: TaskStatus.PENDING,
    checkList: [
      'Don appropriate PPE (Gloves, Gown, Face Shield)',
      'Contain spill with absorbent material',
      'Apply hospital-grade disinfectant (10 min contact time)',
      'Dispose of waste in biohazard container',
      'Final mop with disinfectant'
    ],
    notes: []
  }
];

export const MOCK_HISTORY_TASKS: Task[] = [
  {
    id: 'h1',
    title: 'Isolation Room Terminal Clean',
    description: 'Post C.Diff discharge. Bleach protocol required.',
    locationId: '106',
    roomNumber: '106',
    role: EmployeeRole.EVS,
    priority: TaskPriority.CRITICAL,
    estimatedMinutes: 60,
    actualMinutes: 58,
    status: TaskStatus.COMPLETED,
    completionTimestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
    checkList: ['Biohazard removal', 'Bleach disinfection', 'UV Light cycle', 'Final inspection'],
    notes: [{ id: 'n1', text: 'UV light cycle completed at 14:30', timestamp: new Date().toISOString() }]
  },
  {
    id: 'h2',
    title: 'Wheelchair Repair',
    description: 'Brake mechanism sticking.',
    locationId: 'STATION',
    roomNumber: 'Main Entrance',
    role: EmployeeRole.ENGINEERING,
    priority: TaskPriority.LOW,
    estimatedMinutes: 15,
    actualMinutes: 12,
    status: TaskStatus.COMPLETED,
    completionTimestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
    checkList: ['Inspect brake cable', 'Lube hinges', 'Test load capacity'],
    notes: []
  },
  {
    id: 'h3',
    title: 'Bed Side Rail Maintenance',
    description: 'Loose railing reported.',
    locationId: '104',
    roomNumber: '104',
    role: EmployeeRole.ENGINEERING,
    priority: TaskPriority.MEDIUM,
    estimatedMinutes: 20,
    actualMinutes: 25,
    status: TaskStatus.COMPLETED,
    completionTimestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), // 10 days ago
    checkList: ['Tighten mounting bolts', 'Test locking mechanism'],
    notes: [{ id: 'n2', text: 'Requires part order for next maintenance cycle', timestamp: new Date().toISOString() }]
  },
  {
    id: 'h4',
    title: 'Stat Patient Move',
    description: 'Emergency transfer to ICU.',
    locationId: '102',
    roomNumber: '102',
    role: EmployeeRole.TRANSPORTER,
    priority: TaskPriority.CRITICAL,
    estimatedMinutes: 10,
    actualMinutes: 8,
    status: TaskStatus.COMPLETED,
    completionTimestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(), // 1 day ago
    checkList: ['Check patient ID', 'Move with respiratory therapist'],
    notes: []
  }
];
