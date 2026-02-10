
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Task, TaskPriority, EmployeeRole, TaskNote } from '../types';
import { Clock, MapPin, CheckCircle, ShieldCheck, ChevronDown, ChevronUp, Play, Pause, XCircle, Activity, Footprints, Camera, Image as ImageIcon, RotateCcw, X, AlertTriangle, Check, BookOpen, FileText, Download, Printer, ClipboardCheck, MessageSquare, Plus, Send, HandHelping } from 'lucide-react';
import FloorMap from './FloorMap';
import { LOCATIONS } from '../constants';

interface TaskViewProps {
  task: Task;
  onComplete: (photo?: string) => void;
  onCancel: () => void;
  onAddNote: (note: string, photo?: string) => void;
  onRequestFollowUp: (role: EmployeeRole, title: string) => void;
  showNavigation: boolean;
  onToggleNavigation: () => void;
  isExternalPaused?: boolean;
  elapsedSeconds: number;
  isPaused: boolean;
  onTogglePause: () => void;
  userLocationId: string;
}

const CANCELLATION_REASONS = [
  "Patient Refusal",
  "Room Occupied / Patient Sleeping",
  "Procedure in Progress",
  "Biohazard Spike at another location",
  "Missing Supplies",
  "Equipment Malfunction",
  "Assigned in Error",
  "Shift Ended"
];

const FOLLOWUP_OPTIONS = {
  [EmployeeRole.EVS]: [
    { label: "Post-Repair Clean", role: EmployeeRole.EVS },
    { label: "Spill Response", role: EmployeeRole.EVS },
    { label: "Trash/Linen Full", role: EmployeeRole.EVS },
    { label: "Room Turnover", role: EmployeeRole.EVS }
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
  ]
};

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
  onTogglePause,
  userLocationId
}) => {
  const [showProtocol, setShowProtocol] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpSent, setFollowUpSent] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [notePhoto, setNotePhoto] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<'task' | 'note' | null>(null);
  const [completedItems, setCompletedItems] = useState<Set<number>>(new Set());
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<Set<string>>(new Set());
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCurrentlyPaused = isPaused || isExternalPaused;
  const currentMinutes = Math.floor(elapsedSeconds / 60);
  const isDelayed = currentMinutes > task.estimatedMinutes;
  const progress = (currentMinutes / task.estimatedMinutes) * 100;

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
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

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
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
    setFollowUpSent(true);
    setTimeout(() => {
      setShowFollowUp(false);
      setFollowUpSent(false);
    }, 1500);
  };

  const toggleReason = (reason: string) => {
    const next = new Set(selectedReasons);
    if (next.has(reason)) next.delete(reason);
    else next.add(reason);
    setSelectedReasons(next);
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

  // Determine which departments we can request support from
  const targetRoles = useMemo(() => {
    if (task.role === EmployeeRole.EVS) return [EmployeeRole.ENGINEERING, EmployeeRole.BIOMED];
    return [EmployeeRole.EVS, task.role === EmployeeRole.ENGINEERING ? EmployeeRole.BIOMED : EmployeeRole.ENGINEERING];
  }, [task.role]);

  // Determine grid columns based on button count
  const hasManual = !!task.serviceManualSections;
  const gridCols = hasManual ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3';

  return (
    <div className="flex flex-col pb-72">
      <canvas ref={canvasRef} className="hidden" />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Follow-up Request Modal */}
      {showFollowUp && (
        <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            {followUpSent ? (
              <div className="p-12 flex flex-col items-center justify-center text-center animate-in zoom-in-95">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle size={40} className="text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Request Sent</h3>
                <p className="text-sm text-gray-500">Service ticket generated for {task.roomNumber}</p>
              </div>
            ) : (
              <>
                <div className="p-5 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                  <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Request Support</h3>
                    <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">FOR ROOM {task.roomNumber}</p>
                  </div>
                  <button 
                    onClick={() => setShowFollowUp(false)} 
                    className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm text-slate-600 dark:text-white hover:bg-slate-100 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="p-4 space-y-6 max-h-[60vh] overflow-y-auto">
                  {targetRoles.map(role => (
                    <div key={role} className="space-y-3">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">{role}</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {FOLLOWUP_OPTIONS[role].map(opt => (
                          <button 
                            key={opt.label}
                            onClick={() => handleSendFollowUp(opt.role, opt.label)}
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-slate-100 dark:border-slate-700 rounded-2xl text-left transition-all active:scale-95"
                          >
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900 flex justify-center border-t">
                  <p className="text-[10px] text-slate-400 text-center italic">Location and Room ID will be automatically linked to this request.</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Service Manual Overlay */}
      {showManual && task.serviceManualSections && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center animate-in fade-in duration-300">
          <div className="bg-[#fdfdfd] dark:bg-slate-900 w-full max-w-xl h-[92vh] sm:h-[80vh] sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden border-x border-t border-gray-200 dark:border-slate-800 animate-in slide-in-from-bottom duration-300">
            <div className="bg-slate-100 dark:bg-slate-800 p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-rose-600" />
                <div>
                  <h3 className="text-xs font-black text-gray-900 dark:text-slate-100 uppercase tracking-tight">
                    {task.serviceManualTitle || 'Service Manual'}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">SERVICE DOCUMENTATION</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {task.serviceManualDownloadUrl && (
                  <a href={task.serviceManualDownloadUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-gray-600">
                     <Download size={18} />
                  </a>
                )}
                <button onClick={() => setShowManual(false)} className="p-2 bg-gray-200 dark:bg-slate-700 rounded-full">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-grow overflow-y-auto p-6 space-y-8 font-serif leading-relaxed text-gray-800 dark:text-slate-300">
              {task.serviceManualSections.map((section, idx) => (
                <section key={idx} className="border-b border-gray-100 dark:border-slate-800 pb-8 last:border-0">
                  <h4 className="font-sans text-xs font-black text-rose-700 dark:text-rose-50 uppercase tracking-widest mb-4">
                    {section.heading}
                  </h4>
                  <p className="text-sm">{section.content}</p>
                  {idx === 0 && task.serviceManualImageUrl && (
                    <img src={task.serviceManualImageUrl} alt="System Diagram" className="mt-6 w-full rounded-xl border border-gray-200 shadow-sm" />
                  )}
                </section>
              ))}
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 flex justify-center">
               <button onClick={() => setShowManual(false)} className="px-8 py-3 bg-[#2164f3] text-white font-bold rounded-xl text-sm shadow-xl">CLOSE MANUAL</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Dialog Overlay */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Cancel Task?</h3>
              <p className="text-xs text-gray-500">Please select reason for cancellation.</p>
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-2">
              {CANCELLATION_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => toggleReason(reason)}
                  className={`w-full p-4 rounded-2xl border text-left text-sm font-medium transition-all ${
                    selectedReasons.has(reason) ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-transparent text-gray-600'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="p-4 bg-slate-50 flex flex-col gap-2">
              <button onClick={() => onCancel()} disabled={selectedReasons.size === 0} className="w-full py-3.5 bg-rose-600 text-white font-bold rounded-xl disabled:opacity-50">CONFIRM CANCELLATION</button>
              <button onClick={() => setShowCancelDialog(false)} className="w-full py-3.5 text-gray-500 font-bold">GO BACK</button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Interface */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="p-4 flex justify-between"><button onClick={stopCamera} className="text-white"><X size={24} /></button></div>
          <div className="flex-grow relative flex items-center justify-center overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          </div>
          <div className="p-10 flex justify-center bg-black/60">
            <button onClick={capturePhoto} className="w-24 h-24 rounded-full border-4 border-white p-1.5">
              <div className="w-full h-full bg-white rounded-full" />
            </button>
          </div>
        </div>
      )}

      {/* Task Header */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 mb-3">
        <div className="flex justify-between items-start mb-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
            {task.priority} Priority
          </span>
          <div className="flex items-center gap-1 text-gray-400">
            <ShieldCheck size={14} />
            <span className="text-[9px] font-medium uppercase tracking-tight">HIPAA Compliant</span>
          </div>
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 leading-tight mb-1">{task.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-gray-500 text-xs">
          <div className="flex items-center gap-1 text-blue-600 font-semibold">
            <MapPin size={14} />
            {task.roomNumber}
          </div>
          <span className="text-gray-300">|</span>
          <span className="text-xs">{task.role}</span>
          {travelTime > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">{travelTime} MIN WALK</span>
            </>
          )}
        </div>
      </div>

      {/* Timer Section */}
      <div className={`p-3 rounded-xl shadow-sm border mb-3 ${isDelayed ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <Clock size={18} className={isDelayed ? 'text-red-500' : 'text-blue-500'} />
            <span className={`text-xl font-mono font-bold ${isDelayed ? 'text-red-600' : 'text-blue-600'}`}>
              {Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
            </span>
            {isCurrentlyPaused && <span className="text-[10px] font-bold text-amber-600 animate-pulse ml-1">PAUSED</span>}
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase text-gray-400 font-bold tracking-widest">Target</p>
            <p className="text-xs font-bold text-gray-700">{task.estimatedMinutes}m</p>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
          <div className={`h-full ${isDelayed ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      </div>

      {/* Toggle Buttons Grid - Optimized for full-width layout */}
      <div className={`grid gap-2 mb-3 ${gridCols}`}>
        <button 
          onClick={onToggleNavigation}
          className={`flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl border text-[9px] font-black tracking-wider transition-all ${showNavigation ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-inner' : 'bg-white border-gray-100 text-gray-500'}`}
        >
          <MapPin size={16} />
          NAV MAP
        </button>
        <button 
          onClick={() => setShowProtocol(!showProtocol)}
          className={`flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl border text-[9px] font-black tracking-wider transition-all ${showProtocol ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-inner' : 'bg-white border-gray-100 text-gray-500'}`}
        >
          <CheckCircle size={16} />
          PROTOCOL
        </button>
        <button 
          onClick={() => setShowNotes(!showNotes)}
          className={`flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl border text-[9px] font-black tracking-wider transition-all ${showNotes ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-inner' : 'bg-white border-gray-100 text-gray-500'}`}
        >
          <MessageSquare size={16} />
          NOTES ({task.notes?.length || 0})
        </button>
        {hasManual && (
          <button 
            onClick={() => setShowManual(true)}
            className="flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl border border-rose-100 bg-rose-50 text-rose-700 text-[9px] font-black tracking-wider animate-pulse"
          >
            <BookOpen size={16} />
            SERVICE MANUAL
          </button>
        )}
      </div>

      {showNavigation && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-3 animate-in slide-in-from-top-2">
          <div className="p-3 border-b bg-blue-50/30">
            <h2 className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-2">
               <Activity size={14} /> Floor Navigation
            </h2>
          </div>
          <div className="p-3">
            <FloorMap currentLocationId={userLocationId} destinationLocationId={task.locationId} />
          </div>
        </div>
      )}

      {showProtocol && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-3 animate-in slide-in-from-top-2">
          <div className="p-3 border-b bg-emerald-50/30">
            <h2 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-2">
               <CheckCircle size={14} /> Task Protocol
            </h2>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-slate-800">
            {task.checkList.map((item, i) => (
              <button key={i} onClick={() => toggleItem(i)} className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 text-left">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${completedItems.has(i) ? 'bg-emerald-500 border-emerald-500' : 'border-gray-200'}`}>
                  {completedItems.has(i) && <Check size={12} className="text-white" />}
                </div>
                <span className={`text-xs ${completedItems.has(i) ? 'text-gray-400 line-through' : 'text-gray-700 font-medium'}`}>{item}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showNotes && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-3 animate-in slide-in-from-top-2">
          <div className="p-3 border-b bg-indigo-50/30">
            <h2 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-2">
               <MessageSquare size={14} /> Task Notes
            </h2>
          </div>
          <div className="p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a technical note..."
                  className="flex-grow bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-950 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddNoteInternal()}
                />
                <button 
                  onClick={startCamera('note')}
                  className={`p-2.5 rounded-xl border border-slate-200 transition-colors ${cameraMode === 'note' ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'}`}
                >
                  <Camera size={18} />
                </button>
                <button 
                  onClick={triggerFileUpload}
                  className={`p-2.5 rounded-xl border border-slate-200 transition-colors ${notePhoto ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'}`}
                >
                  <ImageIcon size={18} />
                </button>
                <button 
                  onClick={handleAddNoteInternal}
                  disabled={!newNote.trim() && !notePhoto}
                  className="bg-indigo-600 text-white p-2.5 rounded-xl disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
              {notePhoto && (
                <div className="relative w-20 h-20 group animate-in zoom-in-90">
                  <img src={notePhoto} alt="Note Attachment" className="w-full h-full object-cover rounded-lg border border-indigo-200 shadow-sm" />
                  <button 
                    onClick={() => setNotePhoto(null)}
                    className="absolute -top-1 -right-1 bg-white border border-slate-200 rounded-full p-0.5 text-slate-500 shadow-sm"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {task.notes && task.notes.length > 0 ? (
                task.notes.slice().reverse().map((note) => (
                  <div key={note.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl flex gap-3 items-start">
                    <div className="flex-grow">
                      <p className="text-xs text-slate-700 dark:text-slate-200 mb-1 leading-relaxed whitespace-pre-wrap">{note.text}</p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">
                        {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {note.photo && (
                      <img 
                        src={note.photo} 
                        alt="Note Evidence" 
                        className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-600 flex-shrink-0 cursor-pointer" 
                        onClick={() => window.open(note.photo, '_blank')}
                      />
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <p className="text-xs text-slate-400 italic">No notes added to this task.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-3 shadow-[0_-8px_30px_rgba(0,0,0,0.1)] z-40 max-w-md mx-auto">
        
        <button 
          onClick={() => setShowFollowUp(true)}
          className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black py-3 rounded-xl shadow-sm transition-all active:scale-95 text-xs uppercase tracking-widest border border-slate-200 dark:border-slate-600"
        >
          <HandHelping size={16} />
          Request Support Follow-up
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={onTogglePause}
            disabled={isExternalPaused}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 ${isPaused ? 'bg-amber-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-100'}`}
          >
            {isPaused ? <Play size={18} /> : <Pause size={18} />}
            {isPaused ? 'RESUME' : 'PAUSE'}
          </button>
          <button 
            onClick={() => setShowCancelDialog(true)}
            className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl shadow-md shadow-rose-100 transition-all active:scale-95 text-sm"
          >
            <XCircle size={18} />
            CANCEL
          </button>
        </div>

        <div className="relative">
          {!capturedPhoto ? (
            <button 
              onClick={startCamera('task')}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-800 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-95 text-sm"
            >
              <Camera size={18} />
              TAKE PHOTO TO COMPLETE
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-gray-200 dark:border-slate-700 animate-in slide-in-from-bottom-2">
              <img src={capturedPhoto} alt="Proof" className="w-14 h-14 rounded-lg object-cover border-2 border-indigo-100" />
              <div className="flex-grow">
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">Photo Attached</p>
                <p className="text-[9px] text-gray-500 italic">Ready for completion</p>
              </div>
              <button onClick={startCamera('task')} className="p-2.5 bg-white dark:bg-slate-700 text-gray-500 rounded-lg border border-gray-200 dark:border-slate-600 shadow-sm">
                <RotateCcw size={16} />
              </button>
            </div>
          )}
        </div>

        <button 
          onClick={() => onComplete(capturedPhoto || undefined)}
          disabled={!capturedPhoto}
          className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale ${capturedPhoto ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100' : 'bg-gray-200 text-gray-400'}`}
        >
          <CheckCircle size={22} />
          {capturedPhoto ? 'COMPLETE TASK' : 'PHOTO REQUIRED'}
        </button>
      </div>
    </div>
  );
};

export default TaskView;
