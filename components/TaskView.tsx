
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Task, TaskPriority, EmployeeRole, TaskNote, AssetStatus } from '../types';
import { 
  Clock, MapPin, CheckCircle, ShieldCheck, Play, Pause, XCircle, Activity, 
  Camera, Image as ImageIcon, RotateCcw, X, AlertTriangle, Check, BookOpen, 
  FileText, Download, MessageSquare, HandHelping, Laptop, ArrowRightLeft, 
  ShieldAlert, Package, User, HelpCircle, Coffee, Trash2, Users, CalendarClock, 
  Zap, ChevronLeft, ExternalLink
} from 'lucide-react';
import FloorMap from './FloorMap';
import { LOCATIONS } from '../constants';

interface TaskViewProps {
  task: Task;
  onComplete: (photo?: string, assetUpdates?: Partial<Task>) => void;
  onCancel: (reasons: string[]) => void;
  onAddNote: (note: string, photo?: string) => void;
  onRequestFollowUp: (role: EmployeeRole, title: string) => void;
  showNavigation: boolean;
  onToggleNavigation: () => void;
  isExternalPaused?: boolean;
  elapsedSeconds: number;
  isPaused: boolean;
  isStarted: boolean;
  onStart: () => void;
  onTogglePause: () => void;
  userLocationId: string;
  rotationIndex?: number;
}

const CANCELLATION_REASONS = [
  "Patient Refusal",
  "Room Occupied / Patient Sleeping",
  "Procedure in Progress",
  "Biohazard Spike (Emergency)",
  "Missing Supplies",
  "Equipment Malfunction",
  "Assigned in Error",
  "Shift Ended"
];

const PAUSE_REASONS = [
  { id: 'supplies', label: "Missing Supplies", icon: <Package size={18} /> },
  { id: 'parts', label: "Need Parts", icon: <Laptop size={18} /> },
  { id: 'personal', label: "Personal Break", icon: <Coffee size={18} /> },
  { id: 'supervisor', label: "Consulting Lead", icon: <User size={18} /> },
  { id: 'wait', label: "Waiting for Access", icon: <ShieldCheck size={18} /> },
  { id: 'other', label: "Other / Operational", icon: <HelpCircle size={18} /> },
];

const PULL_REASONS = [
  "Physical Damage",
  "Battery Failure",
  "Software/Error Code",
  "Recall/Safety Notice",
  "Routine Maintenance Due",
  "Failed Calibration",
  "Fluid Ingress"
];

const IMMEDIATE_HELP_OPTIONS = [
  { label: "Need 2nd Person (Lifting/Safety)", icon: <Users size={16} /> },
  { label: "Need Supervisor Consultation", icon: <ShieldCheck size={16} /> },
  { label: "Supply/Equipment Emergency", icon: <Zap size={16} /> },
  { label: "Need Technical Guidance", icon: <HelpCircle size={16} /> }
];

const FOLLOWUP_OPTIONS = {
  [EmployeeRole.EVS]: [
    { label: "Daily Clean Required", role: EmployeeRole.EVS },
    { label: "Post-Repair Terminal Clean", role: EmployeeRole.EVS },
    { label: "Spill Response", role: EmployeeRole.EVS },
    { label: "Trash/Linen Full", role: EmployeeRole.EVS }
  ],
  [EmployeeRole.ENGINEERING]: [
    { label: "HVAC Temperature Check", role: EmployeeRole.ENGINEERING },
    { label: "Plumbing Leak/Clog", role: EmployeeRole.ENGINEERING },
    { label: "Electrical/Lighting", role: EmployeeRole.ENGINEERING },
    { label: "Furniture/Bed Repair", role: EmployeeRole.ENGINEERING }
  ],
  [EmployeeRole.BIOMED]: [
    { label: "Equipment Malfunction", role: EmployeeRole.BIOMED },
    { label: "Battery Check", role: EmployeeRole.BIOMED },
    { label: "Calibration Required", role: EmployeeRole.BIOMED }
  ],
  [EmployeeRole.TRANSPORTER]: [
    { label: "Patient Discharge Transport", role: EmployeeRole.TRANSPORTER },
    { label: "Procedure/Lab Transport", role: EmployeeRole.TRANSPORTER },
    { label: "Stretcher Required", role: EmployeeRole.TRANSPORTER }
  ]
};

type ActiveSection = 'map' | 'protocol' | 'notes' | null;
type SupportFlowStage = 'selection' | 'immediate' | 'followup' | 'sent';

const TaskView: React.FC<TaskViewProps> = ({ 
  task, 
  onComplete, 
  onCancel, 
  onAddNote,
  onRequestFollowUp,
  showNavigation, 
  onToggleNavigation, 
  isExternalPaused = false,
  elapsedSeconds,
  isPaused,
  isStarted,
  onStart,
  onTogglePause,
  userLocationId,
  rotationIndex
}) => {
  const [activeSection, setActiveSection] = useState<ActiveSection>(task.role === EmployeeRole.ED_EVS ? 'map' : null);
  const [showManual, setShowManual] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [supportFlowStage, setSupportFlowStage] = useState<SupportFlowStage>('selection');
  const [supportMessage, setSupportMessage] = useState('');
  
  const [newNote, setNewNote] = useState('');
  const [notePhoto, setNotePhoto] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<'task' | 'note' | null>(null);
  const [completedItems, setCompletedItems] = useState<Set<number>>(new Set());
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  // Dialog States
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<Set<string>>(new Set());

  // Asset Specific States
  const [assetStatus, setAssetStatus] = useState<AssetStatus>(task.assetStatus || AssetStatus.IN_SERVICE);
  const [pullReason, setPullReason] = useState<string | null>(null);
  const [replacementId, setReplacementId] = useState('');
  const [showAssetModal, setShowAssetModal] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCurrentlyPaused = isPaused || isExternalPaused;
  const currentMinutes = Math.floor(elapsedSeconds / 60);
  const isDelayed = currentMinutes > task.estimatedMinutes;
  const progress = (currentMinutes / task.estimatedMinutes) * 100;

  useEffect(() => {
    if (showNavigation && activeSection !== 'map') {
      setActiveSection('map');
    } else if (!showNavigation && activeSection === 'map') {
      setActiveSection(null);
    }
  }, [showNavigation]);

  useEffect(() => {
    if (isCameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraOpen]);

  const toggleItem = (idx: number) => {
    const next = new Set(completedItems);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setCompletedItems(next);
  };

  const startCamera = (mode: 'task' | 'note') => async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      streamRef.current = stream;
      setCameraMode(mode);
      setIsCameraOpen(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setCameraMode(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        if (cameraMode === 'task') {
          setCapturedPhoto(dataUrl);
        } else if (cameraMode === 'note') {
          setNotePhoto(dataUrl);
        }
        stopCamera();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNotePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddNoteInternal = () => {
    if (newNote.trim() || notePhoto) {
      onAddNote(newNote.trim(), notePhoto || undefined);
      setNewNote('');
      setNotePhoto(null);
    }
  };

  const handleSendFollowUp = (role: EmployeeRole, label: string) => {
    onRequestFollowUp(role, label);
    setSupportMessage(`Follow-up ticket generated for ${task.roomNumber}`);
    setSupportFlowStage('sent');
    setTimeout(() => {
      setShowFollowUp(false);
      setSupportFlowStage('selection');
    }, 1500);
  };

  const handleSendImmediateHelp = (label: string) => {
    onAddNote(`[Support Requested] Immediate help needed: ${label}`);
    setSupportMessage(`Assistance requested. A notification was sent to nearby ${task.role} staff.`);
    setSupportFlowStage('sent');
    setTimeout(() => {
      setShowFollowUp(false);
      setSupportFlowStage('selection');
    }, 1500);
  };

  const handleCompleteInternal = () => {
    const assetUpdates = task.isAssetTask ? {
      assetStatus,
      pullReason: pullReason || undefined,
      assetReplacementId: replacementId
    } : {};
    onComplete(capturedPhoto || undefined, assetUpdates);
  };

  const handlePauseRequest = () => {
    if (isPaused) {
      onTogglePause();
    } else {
      setShowPauseDialog(true);
    }
  };

  const confirmPause = (reason: string) => {
    onAddNote(`[System] Task paused: ${reason}`);
    onTogglePause();
    setShowPauseDialog(false);
  };

  const confirmCancel = () => {
    const reasons = Array.from(selectedReasons);
    onAddNote(`[System] Task cancelled for reasons: ${reasons.join(', ')}`);
    onCancel(reasons);
  };

  const toggleReason = (reason: string) => {
    const next = new Set(selectedReasons);
    if (next.has(reason)) next.delete(reason);
    else next.add(reason);
    setSelectedReasons(next);
  };

  const handleToggleSection = (section: ActiveSection) => {
    const nextSection = activeSection === section ? null : section;
    setActiveSection(nextSection);
    if (section === 'map' || activeSection === 'map') {
      onToggleNavigation();
    }
  };

  const travelTime = useMemo(() => {
    const current = LOCATIONS.find(l => l.id === userLocationId);
    const destination = LOCATIONS.find(l => l.id === task.locationId);
    if (!current || !destination || current.id === destination.id) return 0;
    const dist = Math.sqrt(Math.pow(destination.x - current.x, 2) + Math.pow(destination.y - current.y, 2));
    return Math.ceil(dist / 50);
  }, [userLocationId, task.locationId]);

  const getPriorityColor = (p: TaskPriority) => {
    switch (p) {
      case TaskPriority.CRITICAL: return 'bg-red-100 text-red-700 border-red-200';
      case TaskPriority.HIGH: return 'bg-orange-100 text-orange-700 border-orange-200';
      case TaskPriority.MEDIUM: return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const isAssetStepComplete = useMemo(() => {
    if (!task.isAssetTask) return true;
    if (assetStatus === AssetStatus.OUT_OF_SERVICE) {
      return !!pullReason && replacementId.trim().length > 0;
    }
    return true;
  }, [task.isAssetTask, assetStatus, pullReason, replacementId]);

  const hasManual = !!task.serviceManualSections;

  const getButtonClass = (isActive: boolean, variant: 'blue' | 'rose' = 'blue') => {
    const base = "w-full flex items-center justify-center gap-1 py-2.5 px-1 rounded-full border text-[9px] font-black tracking-wider transition-all shadow-sm active:scale-95";
    
    if (variant === 'rose') {
      return `${base} border-rose-100 bg-rose-50 text-rose-700 active:bg-rose-100`;
    }

    return `${base} ${
      isActive 
        ? 'bg-blue-600 border-blue-700 text-white shadow-inner scale-[0.98]' 
        : 'bg-white border-gray-100 text-gray-500 active:bg-slate-50'
    }`;
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="flex-grow overflow-y-auto p-4 pb-[220px]">
        <canvas ref={canvasRef} className="hidden" />
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

        {/* Camera Overlay */}
        {isCameraOpen && (
          <div className="fixed inset-0 z-[200] bg-black flex flex-col">
          <div className="flex-grow relative overflow-hidden">
            <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-x-4 top-4 flex justify-between items-start">
              <button onClick={stopCamera} className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white active:scale-90 transition-transform"><X size={24} /></button>
            </div>
            <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-6">
              <div className="px-4 py-2 bg-black/40 backdrop-blur-md rounded-full text-white text-[10px] font-black uppercase tracking-widest border border-white/20">
                Capture Proof of Service
              </div>
              <button onClick={capturePhoto} className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center">
                <div className="w-16 h-16 bg-white rounded-full active:scale-90 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Modal UI */}
      {showManual && (
        <div className="fixed inset-0 z-[170] bg-slate-950/70 backdrop-blur-md flex items-end sm:items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-5 border-b flex justify-between items-center bg-rose-50/30 dark:bg-rose-950/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 rounded-lg text-rose-600"><BookOpen size={20} /></div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Service Manual</h3>
                  <p className="text-[10px] text-rose-600 font-bold uppercase tracking-widest truncate max-w-[200px]">{task.serviceManualTitle || 'Technical Documentation'}</p>
                </div>
              </div>
              <button onClick={() => setShowManual(false)} className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm text-slate-500 hover:bg-slate-50 active:scale-95 transition-all"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {task.serviceManualImageUrl && (
                <div className="rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm bg-slate-50 dark:bg-slate-800/50 p-2">
                  <img src={task.serviceManualImageUrl} alt="Technical Diagram" className="w-full h-auto rounded-xl" />
                  <p className="text-[9px] text-center mt-2 font-bold text-slate-400 uppercase tracking-widest italic">Reference Diagram Fig 1.A</p>
                </div>
              )}

              {task.serviceManualSections?.map((section, idx) => (
                <div key={idx} className="space-y-2">
                  <h4 className="text-[11px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    {section.heading}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    {section.content}
                  </p>
                </div>
              ))}

              {task.serviceManualDownloadUrl && (
                <a 
                  href={task.serviceManualDownloadUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-slate-700 rounded-xl text-rose-600"><Download size={18} /></div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Full Service PDF</span>
                  </div>
                  <ExternalLink size={16} className="text-slate-300 group-hover:text-rose-600 transition-colors" />
                </a>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t flex flex-col gap-2">
               <button 
                 onClick={() => setShowManual(false)}
                 className="w-full py-4 bg-rose-600 text-white font-black rounded-2xl shadow-xl shadow-rose-100 dark:shadow-none active:scale-95 transition-all text-sm uppercase tracking-widest"
               >
                 Close Manual
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Reason Dialog */}
      {showPauseDialog && (
        <div className="fixed inset-0 z-[160] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Pause size={20} /></div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Pause Task</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Select a reason to log</p>
                </div>
              </div>
              <button onClick={() => setShowPauseDialog(false)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all shadow-sm"><X size={20} /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-3">
              {PAUSE_REASONS.map(reason => (
                <button
                  key={reason.id}
                  onClick={() => confirmPause(reason.label)}
                  className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl flex flex-col items-center gap-2 text-center transition-all hover:bg-amber-50 dark:hover:bg-amber-900/20 active:scale-95 group"
                >
                  <div className="text-slate-400 group-hover:text-amber-600 transition-colors">{reason.icon}</div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 group-hover:text-amber-900 dark:group-hover:text-amber-200">{reason.label}</span>
                </button>
              ))}
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t flex justify-center">
               <button onClick={() => setShowPauseDialog(false)} className="text-sm font-bold text-slate-400 uppercase tracking-widest px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Dialog UI. */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-[160] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 rounded-lg text-rose-600"><XCircle size={20} /></div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Cancel Task</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Select reasons for cancellation</p>
                </div>
              </div>
              <button onClick={() => setShowCancelDialog(false)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all shadow-sm"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-2 max-h-[60vh] overflow-y-auto">
              {CANCELLATION_REASONS.map(reason => (
                <button
                  key={reason}
                  onClick={() => toggleReason(reason)}
                  className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${selectedReasons.has(reason) ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                >
                  <span className="text-sm font-bold">{reason}</span>
                  {selectedReasons.has(reason) && <CheckCircle size={16} className="text-rose-600" />}
                </button>
              ))}
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t flex flex-col gap-2">
               <button 
                 onClick={confirmCancel}
                 disabled={selectedReasons.size === 0}
                 className="w-full py-4 bg-rose-600 text-white font-black rounded-2xl shadow-xl shadow-rose-100 disabled:opacity-50 active:scale-95 transition-all text-sm uppercase tracking-widest"
               >
                 Confirm Cancellation
               </button>
               <button onClick={() => setShowCancelDialog(false)} className="text-sm font-bold text-slate-400 uppercase tracking-widest px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Go Back</button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Status Modal */}
      {showAssetModal && (
        <div className="fixed inset-0 z-[140] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
              <div className="p-5 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <Laptop className="text-blue-600" size={20} />
                    <div>
                      <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Pull Asset from Service</h3>
                      <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">{task.assetId}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowAssetModal(false)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full shadow-sm text-slate-600 dark:text-white hover:bg-slate-200 transition-all active:scale-95"><X size={18} /></button>
              </div>
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Primary Pull Reason</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {PULL_REASONS.map(reason => (
                      <button 
                        key={reason}
                        onClick={() => setPullReason(reason)}
                        className={`w-full p-4 rounded-2xl border text-left transition-all ${pullReason === reason ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                      >
                        <span className="text-sm font-bold">{reason}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Replacement Asset ID</h4>
                  <div className="relative">
                    <input 
                      type="text"
                      value={replacementId}
                      onChange={(e) => setReplacementId(e.target.value.toUpperCase())}
                      placeholder="Enter Serial or Asset ID..."
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2"><ArrowRightLeft size={16} className="text-slate-300" /></div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t">
                <button 
                  onClick={() => { setAssetStatus(AssetStatus.IN_SERVICE); setShowAssetModal(false); }}
                  disabled={!pullReason || replacementId.trim().length < 2}
                  className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 disabled:opacity-50 active:scale-95 transition-all text-sm uppercase tracking-widest"
                >
                  Confirm Asset Change
                </button>
              </div>
           </div>
        </div>
      )}

      {/* Support Modal */}
      {showFollowUp && (
        <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            {supportFlowStage === 'sent' ? (
              <div className="p-12 flex flex-col items-center justify-center text-center animate-in zoom-in-95">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4"><CheckCircle size={40} className="text-emerald-600" /></div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Request Sent</h3>
                <p className="text-sm text-gray-500">{supportMessage}</p>
              </div>
            ) : (
              <>
                <div className="p-5 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center gap-3">
                    {supportFlowStage !== 'selection' && (
                      <button onClick={() => setSupportFlowStage('selection')} className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm text-slate-500"><ChevronLeft size={18} /></button>
                    )}
                    <div>
                      <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                        {supportFlowStage === 'selection' ? 'Request Support' : 
                         supportFlowStage === 'immediate' ? 'Immediate Help' : 'Follow-up Service'}
                      </h3>
                      <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">FOR ROOM {task.roomNumber}</p>
                    </div>
                  </div>
                  <button onClick={() => { setShowFollowUp(false); setSupportFlowStage('selection'); }} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200 transition-all active:scale-95 shadow-sm"><X size={18} /></button>
                </div>

                <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                  {supportFlowStage === 'selection' && (
                    <div className="grid grid-cols-1 gap-4 py-4">
                      <button 
                        onClick={() => setSupportFlowStage('immediate')}
                        className="p-6 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-slate-100 dark:border-slate-700 rounded-2xl flex items-center gap-4 transition-all active:scale-[0.98] text-left group"
                      >
                        <div className="p-4 bg-blue-100 dark:bg-blue-900/50 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform"><Activity size={24} /></div>
                        <div>
                          <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">Help with Current Task</h4>
                          <p className="text-[11px] text-slate-500 font-medium">Request immediate aid from nearby staff</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => setSupportFlowStage('followup')}
                        className="p-6 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border border-slate-100 dark:border-slate-700 rounded-2xl flex items-center gap-4 transition-all active:scale-[0.98] text-left group"
                      >
                        <div className="p-4 bg-emerald-100 dark:bg-emerald-900/50 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform"><CalendarClock size={24} /></div>
                        <div>
                          <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">Schedule Follow-on Support</h4>
                          <p className="text-[11px] text-slate-500 font-medium">Request a different department for later</p>
                        </div>
                      </button>
                    </div>
                  )}

                  {supportFlowStage === 'immediate' && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest px-1">Select Assistance Reason</p>
                      <div className="grid grid-cols-1 gap-2">
                        {IMMEDIATE_HELP_OPTIONS.map(opt => (
                          <button 
                            key={opt.label}
                            onClick={() => handleSendImmediateHelp(opt.label)}
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-slate-100 dark:border-slate-700 rounded-2xl flex items-center gap-3 text-left transition-all active:scale-95"
                          >
                            <div className="text-blue-500">{opt.icon}</div>
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {supportFlowStage === 'followup' && (
                    <div className="space-y-6">
                      {(Object.keys(FOLLOWUP_OPTIONS) as EmployeeRole[]).filter(r => r !== task.role).map(role => (
                        <div key={role} className="space-y-3">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">{role}</h4>
                          <div className="grid grid-cols-1 gap-2">
                            {FOLLOWUP_OPTIONS[role].map(opt => (
                              <button 
                                key={opt.label}
                                onClick={() => handleSendFollowUp(opt.role, opt.label)}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border border-slate-100 dark:border-slate-700 rounded-2xl text-left transition-all active:scale-95"
                              >
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Task Content */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 mb-3">
        <div className="flex justify-between items-start mb-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getPriorityColor(task.priority)}`}>{task.priority} Priority</span>
          <div className="flex items-center gap-1 text-gray-400"><ShieldCheck size={14} /><span className="text-[9px] font-medium uppercase tracking-tight">HIPAA Compliant</span></div>
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 leading-tight mb-1">{task.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-gray-500 text-xs">
          <div className="flex items-center gap-1 text-blue-600 font-semibold"><MapPin size={14} />{task.roomNumber}</div>
          <span className="text-gray-300">|</span><span>{task.role}</span>
          {travelTime > 0 && <><span className="text-gray-300">|</span><span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">{travelTime} MIN WALK</span></>}
        </div>
      </div>

      {/* Asset Control Card */}
      {task.isAssetTask && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-blue-100 dark:border-slate-800 overflow-hidden mb-3">
            <div className="p-3 border-b bg-blue-50/30 flex items-center justify-between">
              <h2 className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-2"><Laptop size={14} /> Asset Management</h2>
              <span className="text-[10px] font-mono font-bold text-slate-900 dark:text-slate-100">{task.assetId}</span>
            </div>
            <div className="p-4 flex items-center justify-between">
               <span className={`text-sm font-black uppercase tracking-tight ${assetStatus === AssetStatus.IN_SERVICE ? 'text-emerald-600' : 'text-rose-600'}`}>{assetStatus}</span>
               <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button onClick={() => setAssetStatus(AssetStatus.IN_SERVICE)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest ${assetStatus === AssetStatus.IN_SERVICE ? 'bg-white dark:bg-slate-700 text-emerald-600' : 'text-slate-400'}`}>In-Service</button>
                  <button onClick={() => setShowAssetModal(true)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest ${assetStatus === AssetStatus.OUT_OF_SERVICE ? 'bg-white dark:bg-slate-700 text-rose-600' : 'text-slate-400'}`}>Pull Out</button>
               </div>
            </div>
        </div>
      )}

      {/* Timer Section */}
      <div className={`p-3 rounded-xl shadow-sm border mb-3 ${isDelayed ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <Clock size={18} className={isDelayed ? 'text-red-500' : 'text-blue-500'} />
            <span className={`text-xl font-mono font-bold ${isDelayed ? 'text-red-600' : 'text-blue-600'}`}>{Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:{(elapsedSeconds % 60).toString().padStart(2, '0')}</span>
            {isCurrentlyPaused && <span className="text-[10px] font-bold text-amber-600 animate-pulse ml-1">PAUSED</span>}
          </div>
          <div className="text-right"><p className="text-[9px] uppercase text-gray-400 font-bold tracking-widest">Target</p><p className="text-xs font-bold text-gray-700">{task.estimatedMinutes}m</p></div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden"><div className={`h-full ${isDelayed ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(progress, 100)}%` }} /></div>
      </div>

      {/* Grid-style Action Buttons - Uniform Width & Full Width */}
      <div className={`grid w-full gap-1.5 mb-4 ${hasManual ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <button onClick={() => handleToggleSection('map')} className={`${getButtonClass(activeSection === 'map')} whitespace-nowrap`}>
          <MapPin size={12} />
          {task.role === EmployeeRole.ED_EVS ? 'ROTATION FLOW' : 'NAV MAP'}
        </button>
        <button onClick={() => handleToggleSection('protocol')} className={`${getButtonClass(activeSection === 'protocol')} whitespace-nowrap`}><CheckCircle size={12} />PROTOCOL</button>
        <button onClick={() => handleToggleSection('notes')} className={`${getButtonClass(activeSection === 'notes')} whitespace-nowrap`}><MessageSquare size={12} />NOTES ({task.notes?.length || 0})</button>
        
        {hasManual && (
          <button onClick={() => setShowManual(true)} className={`${getButtonClass(false, 'rose')} whitespace-nowrap`}>
            <BookOpen size={12} /> MANUAL
          </button>
        )}
      </div>

      {/* Mutually Exclusive Content Area */}
      {activeSection === 'map' && (
        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl mb-3 border border-blue-100 shadow-sm animate-in slide-in-from-top duration-300">
          <FloorMap 
            currentLocationId={userLocationId} 
            destinationLocationId={task.locationId} 
            userRole={task.role} 
            rotationIndex={rotationIndex}
          />
        </div>
      )}

      {activeSection === 'protocol' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-blue-100 mb-3 divide-y shadow-sm animate-in slide-in-from-top duration-300">
          {task.checkList.map((item, i) => (
            <button key={i} onClick={() => toggleItem(i)} className="w-full p-3 flex items-center gap-3 text-left active:bg-slate-50 transition-colors">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${completedItems.has(i) ? 'bg-emerald-500 border-emerald-500' : 'border-gray-200'}`}>{completedItems.has(i) && <Check size={12} className="text-white" />}</div>
              <span className={`text-xs ${completedItems.has(i) ? 'text-gray-400 line-through' : 'text-gray-700 font-medium'}`}>{item}</span>
            </button>
          ))}
        </div>
      )}

      {activeSection === 'notes' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-blue-100 mb-3 p-4 space-y-4 shadow-sm animate-in slide-in-from-top duration-300">
          <div className="flex gap-2">
            <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Technical note..." className="flex-grow bg-slate-100 dark:bg-slate-800 rounded-xl px-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <button onClick={handleAddNoteInternal} disabled={!newNote.trim()} className="bg-blue-600 text-white p-2.5 rounded-xl disabled:opacity-50 active:scale-95 transition-all"><Check size={18} /></button>
          </div>
          {task.notes?.length === 0 ? (
            <p className="text-[10px] text-slate-400 text-center py-2 font-bold uppercase tracking-widest">No notes recorded yet</p>
          ) : (
            task.notes?.slice().reverse().map(note => (
              <div key={note.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs border border-slate-100 dark:border-slate-700">
                <p className="text-slate-700 dark:text-slate-300">{note.text}</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">{new Date(note.timestamp).toLocaleTimeString()}</p>
              </div>
            ))
          )}
        </div>
      )}

      </div>

      {/* Bottom Sticky Action Panel */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t flex flex-col gap-2 shadow-[0_-8px_30px_rgba(0,0,0,0.1)] z-40">
        
        {/* Row 1: Action Controls - Icon Only */}
        <div className="grid grid-cols-4 gap-2">
          <button 
            onClick={() => { setSupportFlowStage('selection'); setShowFollowUp(true); }} 
            className="flex flex-col items-center justify-center gap-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black rounded-2xl border border-slate-200 active:bg-slate-200 transition-colors"
            title="Support"
          >
            <HandHelping size={20} />
            <span className="text-[7px] uppercase tracking-tighter">Support</span>
          </button>

          {!isStarted ? (
            <button 
              onClick={onStart} 
              className="flex flex-col items-center justify-center gap-1 py-3 bg-blue-600 text-white font-black rounded-2xl shadow-md shadow-blue-500/20 transition-all active:scale-95"
              title="Start Task"
            >
              <Play size={20} fill="currentColor" />
              <span className="text-[7px] uppercase tracking-tighter">Start</span>
            </button>
          ) : isPaused ? (
            <button 
              onClick={onTogglePause} 
              className="flex flex-col items-center justify-center gap-1 py-3 bg-emerald-600 text-white font-black rounded-2xl shadow-md shadow-emerald-500/20 transition-all active:scale-95"
              title="Resume Task"
            >
              <Play size={20} fill="currentColor" />
              <span className="text-[7px] uppercase tracking-tighter">Resume</span>
            </button>
          ) : (
            <button 
              onClick={handlePauseRequest} 
              disabled={isExternalPaused}
              className="flex flex-col items-center justify-center gap-1 py-3 bg-amber-500 text-white font-black rounded-2xl shadow-md shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50"
              title="Pause Task"
            >
              <Pause size={20} fill="currentColor" />
              <span className="text-[7px] uppercase tracking-tighter">Pause</span>
            </button>
          )}

          <button 
            onClick={() => setShowCancelDialog(true)} 
            className="flex flex-col items-center justify-center gap-1 bg-rose-600 text-white font-black py-3 rounded-2xl shadow-md shadow-rose-500/20 transition-all active:scale-95"
            title="Cancel Task"
          >
            <XCircle size={20} />
            <span className="text-[7px] uppercase tracking-tighter">Cancel</span>
          </button>

          <button 
            onClick={handleCompleteInternal} 
            disabled={!isStarted || (task.role !== EmployeeRole.ED_EVS && !capturedPhoto) || !isAssetStepComplete} 
            className={`flex flex-col items-center justify-center gap-1 py-3 rounded-2xl shadow-md transition-all active:scale-95 ${isStarted && ((task.role === EmployeeRole.ED_EVS) || capturedPhoto) && isAssetStepComplete ? 'bg-emerald-600 text-white shadow-emerald-500/20' : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-700'}`}
            title="Complete Task"
          >
            <CheckCircle size={20} />
            <span className="text-[7px] uppercase tracking-tighter">Complete</span>
          </button>
        </div>

        {/* Row 2: Proof Flow */}
        <div className="flex flex-col gap-2">
          {capturedPhoto ? (
            <div className="flex items-center gap-2 p-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
              <div className="relative group">
                <img src={capturedPhoto} className="w-10 h-10 rounded-lg object-cover shadow-sm border border-emerald-200" alt="Completion Proof" />
                <button onClick={() => setCapturedPhoto(null)} className="absolute -top-1 -right-1 p-0.5 bg-rose-600 text-white rounded-full shadow-lg active:scale-90 transition-transform"><Trash2 size={8} /></button>
              </div>
              <div className="flex-grow">
                <p className="text-[8px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Photo Captured</p>
              </div>
              <button onClick={startCamera('task')} className="p-2 bg-white dark:bg-slate-800 text-emerald-600 rounded-lg border border-emerald-100 active:bg-emerald-50 transition-colors"><RotateCcw size={12} /></button>
            </div>
          ) : (isStarted && task.role !== EmployeeRole.ED_EVS) ? (
            <button 
              onClick={startCamera('task')} 
              className="w-full py-2.5 bg-blue-600 text-white font-black rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all text-[10px] uppercase tracking-widest"
            >
              <Camera size={16} /> Take Completion Photo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default TaskView;
