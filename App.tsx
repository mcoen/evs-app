
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Task, AppNotification, TaskNote, EmployeeRole, TaskPriority, TaskStatus, User as AppUser, HospitalLocation } from './types';
import { MOCK_TASKS, MOCK_NOTIFICATIONS, MOCK_HISTORY_TASKS, LOCATIONS, MOCK_USERS, ROTATIONAL_PATH, ROTATIONAL_PROTOCOL } from './constants';
import TaskView from './components/TaskView';
import Login from './components/Login';
import { fetchFacilityIqEdPayload } from './facilityiq-api';
import { 
  Coffee, User, Bell, Activity, ChevronLeft, Info, 
  AlertTriangle, AlertCircle, History as HistoryIcon, 
  CheckCircle, Settings, LogOut, Award, TrendingUp, Clock,
  Moon, Sun, ChevronRight, BellRing, Shield, HelpCircle,
  ArrowRight, Sparkles, Menu, Search, ShieldCheck, FileText,
  MapPin, ClipboardList, Star, ShieldAlert, Calendar, X,
  Bot, Mic, Send, Loader2, Wifi, WifiOff
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

type ViewState = 'task' | 'notifications' | 'history' | 'profile' | 'actions' | 'ai';

const MOST_USED_QUERIES = [
  "Where is the nearest supply closet?",
  "How do I clean a C-Diff room?",
  "Find nearest available wheelchair.",
  "Protocol for blood spill cleanup.",
  "Who is the lead supervisor today?"
];

const LIVE_SYNC_MS = 15000;

function findLocationById(locations: HospitalLocation[], locationId: string): HospitalLocation | undefined {
  return locations.find((location) => location.id === locationId);
}

function roomLabel(location: HospitalLocation | undefined): string {
  if (!location) {
    return '';
  }

  const sourceLabel = location.sourceLabel?.trim();
  if (sourceLabel) {
    return sourceLabel;
  }

  const normalized = location.name.replace(/^ED\s*/i, '').trim();
  return normalized || location.name;
}

function buildEdRotationalTask(locationId: string, locations: HospitalLocation[]): Task {
  const bay = findLocationById(locations, locationId);
  const bayLabel = roomLabel(bay) || bay?.name || locationId;
  const bayUnit = bay?.unit ? ` Unit: ${bay.unit}.` : '';
  const zone = bay?.zoneName ? ` Zone: ${bay.zoneName}.` : '';

  return {
    id: `ed-r-${Date.now()}`,
    title: `Rotational Clean - ${bayLabel}`,
    description: `Standard rotational maintenance clean.${bayUnit}${zone}`,
    locationId,
    roomNumber: bayLabel,
    role: EmployeeRole.ED_EVS,
    priority: TaskPriority.LOW,
    estimatedMinutes: 10,
    actualMinutes: 0,
    status: TaskStatus.PENDING,
    checkList: ROTATIONAL_PROTOCOL,
    notes: []
  };
}

function buildEdEmergencyTask(locationId: string, locations: HospitalLocation[]): Task {
  const bay = findLocationById(locations, locationId);
  const bayLabel = roomLabel(bay) || 'Bay';
  const bayUnit = bay?.unit ? ` Unit ${bay.unit}.` : '';

  return {
    id: `stat-${Date.now()}`,
    title: `STAT Clean - ${bayLabel}`,
    description: `CRITICAL: Infectious spill reported. Immediate response required.${bayUnit}`,
    locationId,
    roomNumber: bayLabel,
    role: EmployeeRole.ED_EVS,
    priority: TaskPriority.CRITICAL,
    estimatedMinutes: 15,
    actualMinutes: 0,
    status: TaskStatus.IN_PROGRESS,
    checkList: [
      'Don full PPE immediately',
      'Contain biohazard spill',
      'Apply sporicidal disinfectant',
      'Notify supervisor of completion'
    ],
    notes: []
  };
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedHistory, setCompletedHistory] = useState<Task[]>(MOCK_HISTORY_TASKS);
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<Task | null>(null);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [userLocationId, setUserLocationId] = useState('SUPPLY');
  const [showNextPreview, setShowNextPreview] = useState(false);
  const [showBreakOffer, setShowBreakOffer] = useState(false);
  const [showNavigation, setShowNavigation] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('task');
  const [notifications, setNotifications] = useState<AppNotification[]>(MOCK_NOTIFICATIONS);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTaskPaused, setIsTaskPaused] = useState(false);
  const [isTaskStarted, setIsTaskStarted] = useState(false);
  const [taskSecondsMap, setTaskSecondsMap] = useState<Record<string, number>>({});
  const [rotationIndex, setRotationIndex] = useState(0);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [completedRotationalCount, setCompletedRotationalCount] = useState(0);
  const [facilityName, setFacilityName] = useState('HCA Florida Mercy');
  const [facilitySyncStatus, setFacilitySyncStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [facilitySyncMessage, setFacilitySyncMessage] = useState('Connecting to Facility IQ...');
  const [liveEdLocations, setLiveEdLocations] = useState<HospitalLocation[]>([]);
  const [liveRotationPath, setLiveRotationPath] = useState<string[]>([]);

  // AI Helper States - Initializing with default history for immediate visibility
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<string[]>([
    "C-Diff cleaning protocol",
    "Where is the nearest AED?",
    "Staff elevator status",
    "How to report a needle stick",
    "Biohazard bag disposal rules"
  ]);
  const [isListening, setIsListening] = useState(false);

  const activeRotationPath = liveRotationPath.length ? liveRotationPath : ROTATIONAL_PATH;
  const activeLocations = useMemo(() => {
    const nonEdLocations = LOCATIONS.filter((location) => !location.id.startsWith('ED_'));
    const edLocations = liveEdLocations.length ? liveEdLocations : LOCATIONS.filter((location) => location.id.startsWith('ED_'));
    return [...nonEdLocations, ...edLocations];
  }, [liveEdLocations]);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    const syncFacilityIq = async () => {
      controller?.abort();
      controller = new AbortController();

      try {
        const payload = await fetchFacilityIqEdPayload(controller.signal);
        if (!active) {
          return;
        }

        setLiveEdLocations(payload.edLocations);
        setLiveRotationPath(payload.rotationPath);
        setFacilityName(payload.facilityName);
        setFacilitySyncStatus('online');
        setFacilitySyncMessage(
          `Revision ${payload.revision} synced at ${new Date(payload.lastChangedAt).toLocaleTimeString()}`
        );
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setLiveEdLocations([]);
        setLiveRotationPath([]);
        setFacilitySyncStatus('offline');
        setFacilitySyncMessage('Facility IQ API unavailable. Using default ED configuration.');
      }
    };

    syncFacilityIq();
    const interval = window.setInterval(syncFacilityIq, LIVE_SYNC_MS);

    return () => {
      active = false;
      controller?.abort();
      clearInterval(interval);
    };
  }, []);

  // Initialize tasks based on user role
  useEffect(() => {
    if (currentUser) {
      let filteredTasks = MOCK_TASKS.filter(t => t.role === currentUser.role);
      
      if (currentUser.role === EmployeeRole.ED_EVS) {
        // For ED EVS, start only with rotational tasks
        filteredTasks = filteredTasks.filter(t => t.priority === TaskPriority.LOW);

        if (filteredTasks.length === 0) {
          const bayId = activeRotationPath[rotationIndex] ?? ROTATIONAL_PATH[0];
          filteredTasks = [...filteredTasks, buildEdRotationalTask(bayId, activeLocations)];
        }

        setUserLocationId(activeRotationPath[rotationIndex] ?? 'SUPPLY');
      } else {
        setUserLocationId('SUPPLY');
      }
      
      setTasks(filteredTasks);
      setCurrentIndex(0);
      setShowNavigation(currentUser.role === EmployeeRole.ED_EVS);
      
      // Filter history too
      const filteredHistory = MOCK_HISTORY_TASKS.filter(t => t.role === currentUser.role);
      setCompletedHistory(filteredHistory);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role !== EmployeeRole.ED_EVS || !liveEdLocations.length) {
      return;
    }

    setTasks((previousTasks) => {
      let changed = false;
      const updatedTasks = previousTasks.map((task) => {
        if (task.role !== EmployeeRole.ED_EVS) {
          return task;
        }

        const refreshedTask =
          task.priority === TaskPriority.CRITICAL
            ? buildEdEmergencyTask(task.locationId, activeLocations)
            : task.priority === TaskPriority.LOW
              ? buildEdRotationalTask(task.locationId, activeLocations)
              : null;

        if (!refreshedTask) {
          return task;
        }

        if (
          task.title === refreshedTask.title &&
          task.description === refreshedTask.description &&
          task.roomNumber === refreshedTask.roomNumber
        ) {
          return task;
        }

        changed = true;
        return {
          ...task,
          title: refreshedTask.title,
          description: refreshedTask.description,
          roomNumber: refreshedTask.roomNumber
        };
      });

      return changed ? updatedTasks : previousTasks;
    });
  }, [currentUser?.role, liveEdLocations, activeLocations]);

  const activeTask = tasks[currentIndex];
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('task');
    setRotationIndex(0);
    setShowNavigation(false);
    setIsEmergencyActive(false);
    setCompletedRotationalCount(0);
  };

  // Split history into Today and Past 30 Days
  const { todayHistory, pastHistory } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sorted = [...completedHistory].sort((a, b) => {
      const dateA = a.completionTimestamp ? new Date(a.completionTimestamp).getTime() : 0;
      const dateB = b.completionTimestamp ? new Date(b.completionTimestamp).getTime() : 0;
      return dateB - dateA;
    });

    const todayList: Task[] = [];
    const pastList: Task[] = [];

    sorted.forEach(t => {
      if (!t.completionTimestamp) {
        todayList.push(t);
        return;
      }
      const completionDate = new Date(t.completionTimestamp);
      if (completionDate >= today) {
        todayList.push(t);
      } else {
        pastList.push(t);
      }
    });

    return { todayHistory: todayList, pastHistory: pastList };
  }, [completedHistory]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let interval: number | undefined;
    if (isTaskStarted && !isOnBreak && !isTaskPaused && !showNextPreview && !showBreakOffer) {
      interval = window.setInterval(() => {
        setElapsedSeconds(s => s + 1);
        if (activeTask) {
          setTaskSecondsMap(prev => ({ ...prev, [activeTask.id]: (prev[activeTask.id] || 0) + 1 }));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTaskStarted, isOnBreak, isTaskPaused, showNextPreview, showBreakOffer, activeTask]);

  useEffect(() => {
    if (activeTask) {
      setElapsedSeconds(taskSecondsMap[activeTask.id] || 0);
      setIsTaskStarted(!!taskSecondsMap[activeTask.id]);
      // If switching back to a started task, pause it for explicit resume
      setIsTaskPaused(!!taskSecondsMap[activeTask.id]);
    }
  }, [currentIndex, activeTask?.id]);

  useEffect(() => {
    if (
      currentUser?.role === EmployeeRole.ED_EVS && 
      completedRotationalCount === 1 && 
      elapsedSeconds === 15 && 
      activeTask?.priority === TaskPriority.LOW &&
      !isEmergencyActive
    ) {
      triggerEmergency();
    }
  }, [elapsedSeconds, completedRotationalCount, currentUser, activeTask, isEmergencyActive]);

  const triggerEmergency = () => {
    if (!currentUser || currentUser.role !== EmployeeRole.ED_EVS) return;
    const emergencyLocationId =
      activeRotationPath[Math.min(2, Math.max(activeRotationPath.length - 1, 0))] ?? 'ED_BAY3';
    const emergencyTask = buildEdEmergencyTask(emergencyLocationId, activeLocations);

    setTasks(prev => [emergencyTask, ...prev]);
    // Keep user on current task but increment index since we inserted at 0
    setCurrentIndex(prev => prev + 1);
    setIsEmergencyActive(true);
    
    setNotifications(prev => [{
      id: `n-stat-${Date.now()}`,
      title: 'STAT INTERRUPTION',
      message: 'Critical task assigned. Click to view.',
      time: 'Just now',
      read: false,
      type: 'critical'
    }, ...prev]);
  };

  const switchToTask = (index: number) => {
    setCurrentIndex(index);
    setCurrentView('task');
  };

  const handleTaskCompletion = (photo?: string, assetUpdates?: Partial<Task>) => {
    const isCritical = activeTask.priority === TaskPriority.CRITICAL;
    const completedTask: Task = { 
      ...activeTask, 
      ...assetUpdates,
      status: TaskStatus.COMPLETED,
      actualMinutes: Math.floor(elapsedSeconds / 60),
      completionTimestamp: new Date().toISOString()
    };

    setCompletedHistory([completedTask, ...completedHistory]);
    setUserLocationId(activeTask.locationId);
    
    if (currentUser?.role === EmployeeRole.ED_EVS && activeTask.priority === TaskPriority.LOW) {
      setCompletedRotationalCount(prev => prev + 1);
    }
    
    if (isCritical) {
      // Immediately return to the previous task for STAT completions
      setIsEmergencyActive(false);
      setNotifications(prev => prev.map(n => n.type === 'critical' ? { ...n, read: true } : n));
      setTasks(prev => {
        const next = [...prev];
        next.splice(currentIndex, 1);
        return next;
      });
      setCurrentIndex(0);
      setIsTaskStarted(false); // Reset start state for the returned task
    } else {
      // For normal tasks, show the break offer
      if (currentIndex < tasks.length - 1 || currentUser?.role === EmployeeRole.ED_EVS) {
        setShowBreakOffer(true);
      } else {
        alert("Shift Tasks Completed!");
      }
    }
  };

  const handleAddNote = (noteText: string, photo?: string) => {
    const note: TaskNote = {
      id: Math.random().toString(36).substr(2, 9),
      text: noteText,
      timestamp: new Date().toISOString(),
      photo: photo
    };

    setTasks(prevTasks => {
      const newTasks = [...prevTasks];
      const task = newTasks[currentIndex];
      newTasks[currentIndex] = {
        ...task,
        notes: [...(task.notes || []), note]
      };
      return newTasks;
    });
  };

  const handleRequestFollowUp = (role: EmployeeRole, title: string) => {
    const newTask: Task = {
      id: `f-${Math.random().toString(36).substr(2, 5)}`,
      title: title,
      description: `Follow-up requested from ${activeTask.role} during task ${activeTask.id}`,
      locationId: activeTask.locationId,
      roomNumber: activeTask.roomNumber,
      role: role,
      priority: TaskPriority.HIGH,
      estimatedMinutes: 20,
      actualMinutes: 0,
      status: TaskStatus.PENDING,
      checkList: ['Evaluate requested issue', 'Perform necessary service', 'Log completion notes'],
      notes: []
    };

    setTasks(prev => {
      const next = [...prev];
      next.splice(currentIndex + 1, 0, newTask);
      return next;
    });

    const newNotif: AppNotification = {
      id: `n-${Date.now()}`,
      title: 'Follow-up Scheduled',
      message: `${title} for ${activeTask.roomNumber} has been added to the system queue.`,
      time: 'Just now',
      read: false,
      type: 'info'
    };
    setNotifications([newNotif, ...notifications]);
  };

  const proceedToNextTask = () => {
    const completedTask = tasks[currentIndex];
    const wasCritical = completedTask?.priority === TaskPriority.CRITICAL;

    if (wasCritical) {
      // Handle cancellation or skip of emergency task
      setShowBreakOffer(false);
      setIsEmergencyActive(false);
      setNotifications(prev => prev.map(n => n.type === 'critical' ? { ...n, read: true } : n));
      setTasks(prev => {
        const next = [...prev];
        next.splice(currentIndex, 1);
        return next;
      });
      setCurrentIndex(0);
      return;
    }

    setShowBreakOffer(false);
    setShowNextPreview(true);
    setShowNavigation(currentUser?.role === EmployeeRole.ED_EVS);
    setElapsedSeconds(0); // Reset timer for the next task
    
    setTimeout(() => {
      if (currentUser?.role === EmployeeRole.ED_EVS) {
        setTasks(prevTasks => {
          const newTasks = [...prevTasks];
          const taskToRemove = newTasks[currentIndex];
          newTasks.splice(currentIndex, 1);

          let nextRotIdx = rotationIndex;
          if (taskToRemove.priority === TaskPriority.LOW) {
            nextRotIdx = (rotationIndex + 1) % Math.max(activeRotationPath.length, 1);
            setRotationIndex(nextRotIdx);
          }

          if (!newTasks.some(t => t.priority === TaskPriority.LOW)) {
            const bayId = activeRotationPath[nextRotIdx] ?? ROTATIONAL_PATH[0];
            newTasks.push(buildEdRotationalTask(bayId, activeLocations));
          }

          newTasks.sort((a, b) => {
            const priorityMap = { [TaskPriority.CRITICAL]: 0, [TaskPriority.HIGH]: 1, [TaskPriority.MEDIUM]: 2, [TaskPriority.LOW]: 3 };
            return priorityMap[a.priority] - priorityMap[b.priority];
          });

          return newTasks;
        });
        setCurrentIndex(0);
      } else {
        setCurrentIndex(prev => prev + 1);
      }
      setShowNextPreview(false);
    }, 2000);
  };

  // AI Logic
  const handleAiCall = async (query: string) => {
    if (!query.trim()) return;
    setAiLoading(true);
    setAiResponse(null);
    
    // Update Recent Queries (Max 5)
    setAiHistory(prev => [query, ...prev.filter(q => q !== query)].slice(0, 5));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const currentLoc = activeLocations.find((location) => location.id === userLocationId)?.name || "Unknown Location";
      const systemInstruction = `You are a specialized AI assistant for Environmental Services (EVS), Transport, Engineering, and BioMed staff at ${facilityName}. 
      The current user role: ${currentUser?.role}. 
      Current user location: ${currentLoc}. 
      Task in progress: ${activeTask?.title || 'None'} in Room ${activeTask?.roomNumber || 'N/A'}.
      Hospital Locations: ${activeLocations.map((location) => location.name).join(', ')}.
      Always be concise, professional, and helpful. Focus on hospital protocols and equipment locations.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: query,
        config: { systemInstruction }
      });

      setAiResponse(response.text);
    } catch (err) {
      console.error("AI Error:", err);
      setAiResponse("Sorry, I encountered an error processing that request. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const toggleVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser.");
      return;
    }

    if (isListening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAiQuery(transcript);
      handleAiCall(transcript);
    };
    recognition.start();
  };

  const renderHistoryDetail = (task: Task) => (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className="p-5 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800">
          <div>
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Task Summary</h3>
            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">{task.id}</p>
          </div>
          <button onClick={() => setSelectedHistoryTask(null)} className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm text-slate-500 hover:bg-slate-50 active:scale-95 transition-all">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{task.title}</h4>
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
              <MapPin size={14} className="text-blue-600" /> Room {task.roomNumber}
              <span>•</span>
              <Clock size={14} /> Completed in {task.actualMinutes}m
            </div>
            {task.completionTimestamp && (
              <div className="mt-1 flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                <Calendar size={12} /> {new Date(task.completionTimestamp).toLocaleString()}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{task.estimatedMinutes}m</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
              <p className="text-sm font-bold text-emerald-600">SUCCESS</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const HistoryCard: React.FC<{ task: Task }> = ({ task }) => (
    <button 
      onClick={() => setSelectedHistoryTask(task)}
      className="w-full p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm relative overflow-hidden text-left active:scale-[0.98] transition-transform"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">{task.title}</h3>
          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-tight">ROOM {task.roomNumber}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">
          COMPLETED
        </div>
      </div>
      <div className="flex items-center gap-4 text-[10px] text-gray-500 font-medium">
        <span className="flex items-center gap-1"><Clock size={12} /> {task.actualMinutes}m</span>
        <ChevronRight size={14} className="ml-auto text-slate-300" />
      </div>
    </button>
  );

  const renderHistory = () => (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-300 pb-20">
      <div className="flex items-center justify-between mb-6 px-1">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Task History</h2>
        <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
          <HistoryIcon size={12} /> 30 Day Log
        </div>
      </div>
      <div className="space-y-8">
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today</h3>
            <div className="h-px bg-slate-100 dark:bg-slate-800 flex-grow"></div>
          </div>
          <div className="space-y-3">
            {todayHistory.length > 0 ? todayHistory.map(task => <HistoryCard key={task.id} task={task} />) : <p className="text-xs text-slate-400 italic">No tasks today.</p>}
          </div>
        </section>
      </div>
      {selectedHistoryTask && renderHistoryDetail(selectedHistoryTask)}
    </div>
  );

  const renderNotifications = () => (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-300 pb-20">
      <div className="flex items-center justify-between mb-6 px-1">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Notifications</h2>
        <button onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))} className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Mark all read</button>
      </div>
      <div className="space-y-3">
        {notifications.length > 0 ? notifications.map(notif => (
          <button 
            key={notif.id}
            onClick={() => {
              if (notif.type === 'critical') {
                switchToTask(0);
              }
              setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
            }}
            className={`w-full p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${notif.read ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-60' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/40 shadow-sm'}`}
          >
            <div className="flex justify-between items-start mb-1">
              <h3 className={`font-bold text-sm ${notif.type === 'critical' ? 'text-rose-600' : 'text-gray-900 dark:text-white'}`}>{notif.title}</h3>
              <span className="text-[8px] text-slate-400 font-bold uppercase">{notif.time}</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{notif.message}</p>
            {notif.type === 'critical' && !notif.read && (
              <div className="mt-3 flex items-center gap-2 text-[10px] font-black text-rose-600 uppercase tracking-widest">
                <AlertTriangle size={12} /> Action Required
              </div>
            )}
          </button>
        )) : (
          <div className="py-20 text-center">
            <Bell size={40} className="mx-auto text-slate-200 mb-4" />
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">All caught up!</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderAiHelper = () => (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-300 pb-20">
      <div className="flex items-center gap-3 mb-6 px-1">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600"><Bot size={24} /></div>
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">AI Service Assistant</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">HCA Florida Mercy Intelligence</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Output Card */}
        {(aiLoading || aiResponse) && (
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-blue-100 dark:border-slate-800 shadow-lg animate-in fade-in zoom-in-95">
            {aiLoading ? (
              <div className="flex items-center gap-3">
                <Loader2 className="animate-spin text-blue-600" size={24} />
                <p className="text-sm font-bold text-blue-800 dark:text-blue-400 animate-pulse uppercase tracking-widest">Searching Knowledge Base...</p>
              </div>
            ) : (
              <div className="prose dark:prose-invert prose-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {aiResponse}
              </div>
            )}
          </div>
        )}

        {/* Input Card */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-grow">
              <input 
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAiCall(aiQuery)}
                placeholder="Ask Service IQ..."
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none pr-12 shadow-inner"
              />
              <button 
                onClick={toggleVoiceSearch}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-400 hover:text-blue-600'}`}
              >
                <Mic size={20} />
              </button>
            </div>
            <button 
              onClick={() => handleAiCall(aiQuery)}
              disabled={aiLoading || !aiQuery.trim()}
              className="bg-blue-600 text-white p-4 rounded-2xl disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-blue-100"
            >
              <Send size={20} />
            </button>
          </div>

          <div className="space-y-6 pt-2">
            {/* Most Used Section */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                <TrendingUp size={12} className="text-blue-500" />
                Most Used
              </p>
              <div className="flex flex-wrap gap-2">
                {MOST_USED_QUERIES.map((q, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => { setAiQuery(q); handleAiCall(q); }}
                    className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-200 dark:border-slate-700 hover:border-blue-100 active:scale-95"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Queries Section */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                <HistoryIcon size={12} className="text-slate-400" />
                My Recent Queries
              </p>
              {aiHistory.length > 0 ? (
                <div className="space-y-2">
                  {aiHistory.map((h, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => { setAiQuery(h); handleAiCall(h); }}
                      className="w-full text-left p-3 bg-white dark:bg-slate-900 rounded-xl text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-all truncate border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-center group"
                    >
                      <span className="truncate">{h}</span>
                      <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No recent queries yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-300 pb-20">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 mb-6 text-center">
        <div className="relative inline-block mb-4">
          <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 border-4 border-white dark:border-slate-800 shadow-md flex items-center justify-center text-3xl font-black text-blue-600">
            {currentUser?.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="absolute bottom-1 right-1 w-6 h-6 bg-emerald-500 border-4 border-white dark:border-slate-800 rounded-full"></div>
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{currentUser?.name}</h2>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Employee ID: {currentUser?.employeeId}</p>
        <div className="flex items-center justify-center gap-3">
          <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-900/30">
            {currentUser?.role}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <button onClick={handleLogout} className="w-full flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-900/10 text-rose-600 rounded-2xl border border-rose-100 dark:border-rose-900/20 font-bold uppercase tracking-widest text-[10px] active:scale-95 transition-all">
          <div className="flex items-center gap-3">
            <LogOut size={18} />
            Sign Out
          </div>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  const renderActions = () => (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-300 pb-20">
      <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 px-1">Quick Actions</h2>
      <div className="space-y-3">
        <button 
          onClick={() => {
            if (!isOnBreak && isTaskStarted) {
              return;
            }
            setIsOnBreak(!isOnBreak);
            setCurrentView('task');
          }}
          disabled={!isOnBreak && isTaskStarted}
          className={`w-full flex items-center justify-between p-5 rounded-3xl border transition-all active:scale-95 ${
            isOnBreak 
              ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-500/20' 
              : isTaskStarted
                ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-700 border-slate-100 dark:border-slate-800 cursor-not-allowed'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-100 dark:border-slate-800 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${isOnBreak ? 'bg-white/20' : isTaskStarted ? 'bg-slate-100 dark:bg-slate-800' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'}`}>
              <Coffee size={24} />
            </div>
            <div className="text-left">
              <p className="text-sm font-black uppercase tracking-tight">{isOnBreak ? 'End Break' : 'Go on Break'}</p>
              <p className={`text-[10px] font-bold uppercase ${isTaskStarted && !isOnBreak ? 'opacity-40' : 'opacity-60'}`}>
                {isOnBreak ? 'Return to active duty' : isTaskStarted ? 'Complete active task first' : 'Pause assignments'}
              </p>
            </div>
          </div>
          <ChevronRight size={20} className={isOnBreak ? 'text-white' : isTaskStarted ? 'text-slate-200' : 'text-slate-300'} />
        </button>

        <button 
          onClick={handleLogout} 
          className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all active:scale-95"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-2xl">
              <LogOut size={24} />
            </div>
            <div className="text-left">
              <p className="text-sm font-black uppercase tracking-tight text-rose-600">Sign Out</p>
              <p className="text-[10px] font-bold uppercase text-slate-400">End your current session</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-slate-300" />
        </button>

        {currentUser?.role === EmployeeRole.ED_EVS && (
          <button 
            onClick={handleLogout} 
            disabled={isTaskStarted}
            className={`w-full flex items-center justify-between p-5 rounded-3xl border transition-all active:scale-95 ${
              isTaskStarted 
                ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-700 border-slate-100 dark:border-slate-800 cursor-not-allowed' 
                : 'bg-white dark:bg-slate-900 text-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-900/30 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${isTaskStarted ? 'bg-slate-100 dark:bg-slate-800' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200'}`}>
                <ShieldAlert size={24} />
              </div>
              <div className="text-left">
                <p className="text-sm font-black uppercase tracking-tight">End Shift</p>
                <p className={`text-[10px] font-bold uppercase ${isTaskStarted ? 'opacity-40' : 'opacity-60'}`}>
                  {isTaskStarted ? 'Complete active task first' : 'Clock out for the day'}
                </p>
              </div>
            </div>
            <ChevronRight size={20} className={isTaskStarted ? 'text-slate-200' : 'text-blue-700'} />
          </button>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 px-1">Preferences</h2>
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)} 
          className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all active:scale-95"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl">
              {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
            </div>
            <div className="text-left">
              <p className="text-sm font-black uppercase tracking-tight">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</p>
              <p className="text-[10px] font-bold uppercase text-slate-400">Switch app appearance</p>
            </div>
          </div>
          <div className={`w-12 h-6 rounded-full relative transition-colors ${isDarkMode ? 'bg-blue-600' : 'bg-slate-200'}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isDarkMode ? 'left-7' : 'left-1'}`} />
          </div>
        </button>
      </div>
    </div>
  );

  const renderTaskView = () => {
    if (!activeTask) return <div className="p-8 text-center flex flex-col items-center justify-center h-full"><ClipboardList size={48} className="text-slate-300 mb-4" /><h2 className="text-xl font-bold text-slate-400">No Tasks Assigned</h2><p className="text-xs text-slate-400 mt-2">Check back later for new assignments.</p></div>;
    if (isOnBreak) return <div className="p-8 text-center"><Coffee size={40} className="mx-auto text-emerald-500 mb-4" /><h2 className="text-xl font-bold mb-8">On Break</h2><button onClick={() => setIsOnBreak(false)} className="w-full bg-emerald-500 text-white font-bold py-4 rounded-xl">RETURN TO DUTY</button></div>;
    if (showBreakOffer) return <div className="p-8 text-center flex flex-col items-center justify-center h-full"><Sparkles size={40} className="text-emerald-500 mb-4" /><h2 className="text-2xl font-black mb-8">Task Finished!</h2><div className="w-full space-y-3"><button onClick={proceedToNextTask} className="w-full py-5 bg-blue-900 text-white font-bold rounded-2xl">Next Task</button><button onClick={() => setIsOnBreak(true)} className="w-full py-5 bg-white border-2 border-emerald-500 text-emerald-500 font-bold rounded-2xl">Break</button></div></div>;
    if (showNextPreview) return <div className="p-8 text-center"><Activity size={48} className="mx-auto animate-pulse text-blue-500 mb-4" /><h2 className="text-xl font-bold">Getting Next Task...</h2></div>;
    const emergencyTask = tasks.find((task) => task.priority === TaskPriority.CRITICAL);

    return (
      <div className="flex flex-col h-full relative">
        {isEmergencyActive && activeTask.priority !== TaskPriority.CRITICAL && (
          <button 
            onClick={() => switchToTask(0)}
            className="mx-4 mt-4 p-4 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-500/30 flex items-center justify-between animate-bounce"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} />
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Stat Interruption</p>
                <p className="text-xs font-bold">{emergencyTask?.roomNumber || 'Assigned room'} requires immediate clean</p>
              </div>
            </div>
            <ArrowRight size={18} />
          </button>
        )}
        
        <TaskView 
          key={activeTask.id}
          task={activeTask} 
          onComplete={handleTaskCompletion} 
          onCancel={() => proceedToNextTask()}
          onAddNote={handleAddNote}
          onRequestFollowUp={handleRequestFollowUp}
          showNavigation={showNavigation}
          onToggleNavigation={() => setShowNavigation(!showNavigation)}
          elapsedSeconds={elapsedSeconds}
          isPaused={isTaskPaused}
          isStarted={isTaskStarted}
          onStart={() => setIsTaskStarted(true)}
          onTogglePause={() => setIsTaskPaused(!isTaskPaused)}
          userLocationId={userLocationId}
          rotationIndex={rotationIndex}
          locations={activeLocations}
          rotationPath={activeRotationPath}
        />
      </div>
    );
  };

  if (!currentUser) {
    return (
      <div className={`h-screen bg-zinc-900 flex items-center justify-center ${isDarkMode ? 'dark' : ''}`}>
        <div className="h-[92vh] w-full max-w-[400px] bg-slate-950 relative overflow-hidden font-sans shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[3rem] border-[12px] border-zinc-800 flex flex-col">
          {/* Mobile Status Bar Simulation */}
          <div className="h-6 w-full flex justify-between items-center px-6 pt-2 text-[10px] font-bold text-slate-500 z-50">
            <span>9:41</span>
            <div className="flex gap-1.5 items-center">
              <div className="w-3 h-3 rounded-full border border-slate-700 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-slate-700 rounded-full" /></div>
              <div className="w-4 h-2 rounded-sm border border-slate-700 relative"><div className="absolute left-0 top-0 h-full w-3/4 bg-slate-700" /></div>
            </div>
          </div>
          <div className="flex-grow overflow-hidden">
            <Login onLogin={setCurrentUser} />
          </div>
          {/* Home Indicator */}
          <div className="h-6 w-full flex justify-center items-center pb-2">
            <div className="w-32 h-1 bg-slate-800 rounded-full opacity-20" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen bg-zinc-900 flex items-center justify-center ${isDarkMode ? 'dark' : ''}`}>
      <div className="flex flex-col h-[92vh] w-full max-w-[400px] bg-slate-50 dark:bg-slate-950 relative overflow-hidden font-sans shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[3rem] border-[12px] border-zinc-800">
        {/* Mobile Status Bar Simulation */}
        <div className="h-6 w-full flex justify-between items-center px-6 pt-2 text-[10px] font-bold text-slate-500 z-50">
          <span>9:41</span>
          <div className="flex gap-1.5 items-center">
            <div className="w-3 h-3 rounded-full border border-slate-700 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-slate-700 rounded-full" /></div>
            <div className="w-4 h-2 rounded-sm border border-slate-700 relative"><div className="absolute left-0 top-0 h-full w-3/4 bg-slate-700" /></div>
          </div>
        </div>
        <header className="flex flex-col flex-shrink-0 z-30 shadow-lg">
          <div className="bg-blue-900/95 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div onClick={() => setCurrentView('profile')} className="w-10 h-10 rounded-full bg-white/20 border border-white/40 flex items-center justify-center font-bold cursor-pointer active:scale-90 transition-transform">
                {currentUser.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-black uppercase tracking-tight">Service IQ</h1>
                <h2 className="text-[9px] font-bold text-white/80 uppercase tracking-widest">{facilityName}</h2>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setCurrentView('notifications')} className="relative p-1 active:scale-90 transition-transform">
                <Bell size={20} />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-600 rounded-full border-2 border-blue-900" />}
              </button>
              <button onClick={() => setCurrentView('actions')} className="active:scale-90 transition-transform"><Menu size={20} /></button>
            </div>
          </div>
          <div className="bg-[#3152a1] text-white px-5 py-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              {currentUser.role === EmployeeRole.ED_EVS ? (
                facilitySyncStatus === 'online' ? <Wifi size={12} className="text-emerald-400" /> : <WifiOff size={12} className="text-amber-300" />
              ) : (
                <Activity size={12} className="text-emerald-400" />
              )}
              {currentUser.role === EmployeeRole.ED_EVS ? (facilitySyncStatus === 'online' ? 'Facility IQ Sync' : 'Fallback Mode') : 'System Active'}
            </div>
            <div className="flex items-center gap-1 opacity-70"><Clock size={12} /> {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toUpperCase()}</div>
          </div>
          {currentUser.role === EmployeeRole.ED_EVS && (
            <div className={`px-4 py-1 text-[9px] font-bold uppercase tracking-widest ${facilitySyncStatus === 'online' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {facilitySyncMessage}
            </div>
          )}
        </header>

        <main className="flex-grow overflow-hidden relative">
          {currentView === 'history' ? <div className="h-full overflow-y-auto p-4">{renderHistory()}</div> : 
           currentView === 'ai' ? <div className="h-full overflow-y-auto p-4">{renderAiHelper()}</div> : 
           currentView === 'profile' ? <div className="h-full overflow-y-auto p-4">{renderProfile()}</div> : 
           currentView === 'actions' ? <div className="h-full overflow-y-auto p-4">{renderActions()}</div> : 
           currentView === 'notifications' ? <div className="h-full overflow-y-auto p-4">{renderNotifications()}</div> : 
           renderTaskView()}
        </main>

        <nav className="bg-white dark:bg-slate-900 border-t dark:border-slate-800 px-4 py-2 flex justify-between items-center h-16 flex-shrink-0 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <button onClick={() => setCurrentView('task')} className={`flex flex-col items-center gap-1 flex-1 transition-all active:scale-90 ${currentView === 'task' ? 'text-blue-900' : 'text-gray-300'}`}><Activity size={20} /><span className="text-[8px] font-bold uppercase">Tasks</span></button>
          <button onClick={() => setCurrentView('history')} className={`flex flex-col items-center gap-1 flex-1 transition-all active:scale-90 ${currentView === 'history' ? 'text-blue-900' : 'text-gray-300'}`}><HistoryIcon size={20} /><span className="text-[8px] font-bold uppercase">History</span></button>
          <button onClick={() => setCurrentView('ai')} className={`flex flex-col items-center gap-1 flex-1 transition-all active:scale-90 ${currentView === 'ai' ? 'text-blue-900' : 'text-gray-300'}`}><Bot size={20} /><span className="text-[8px] font-bold uppercase">AI Helper</span></button>
          <button onClick={() => setCurrentView('profile')} className={`flex flex-col items-center gap-1 flex-1 transition-all active:scale-90 ${currentView === 'profile' ? 'text-blue-900' : 'text-gray-300'}`}><User size={20} /><span className="text-[8px] font-bold uppercase">Me</span></button>
        </nav>
        {/* Home Indicator */}
        <div className="h-6 w-full flex justify-center items-center pb-2 bg-white dark:bg-slate-900">
          <div className="w-32 h-1 bg-slate-800 dark:bg-slate-700 rounded-full opacity-20" />
        </div>
      </div>
    </div>
  );
};

export default App;
