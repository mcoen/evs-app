
import { EmployeeRole, Task, TaskPriority, TaskStatus, HospitalLocation, AppNotification } from './types';

export const LOCATIONS: HospitalLocation[] = [
  { id: '101', name: 'Room 101', x: 20, y: 30 },
  { id: '102', name: 'Room 102', x: 20, y: 60 },
  { id: '103', name: 'Room 103', x: 20, y: 90 },
  { id: '104', name: 'Room 104', x: 180, y: 30 },
  { id: '105', name: 'Room 105', x: 180, y: 60 },
  { id: '106', name: 'Room 106', x: 180, y: 90 },
  { id: 'STATION', name: 'Nursing Station', x: 100, y: 60 },
  { id: 'SUPPLY', name: 'Supply Closet', x: 100, y: 15 },
  { id: 'BREAK', name: 'Staff Lounge', x: 100, y: 105 },
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

export const MOCK_TASKS: Task[] = [
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
    status: TaskStatus.IN_PROGRESS,
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
  }
];
