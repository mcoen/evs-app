
import React, { useState, useEffect } from 'react';
import { Task, AppNotification, TaskNote, EmployeeRole, TaskPriority, TaskStatus } from './types';
import { MOCK_TASKS, MOCK_NOTIFICATIONS } from './constants';
import TaskView from './components/TaskView';
import { 
  Coffee, User, Bell, Activity, ChevronLeft, Info, 
  AlertTriangle, AlertCircle, History as HistoryIcon, 
  CheckCircle, Settings, LogOut, Award, TrendingUp, Clock,
  Moon, Sun, ChevronRight, BellRing, Shield, HelpCircle,
  ArrowRight, Sparkles, Menu, Search, ShieldCheck, FileText
} from 'lucide-react';

type ViewState = 'task' | 'notifications' | 'history' | 'profile' | 'settings';

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedHistory, setCompletedHistory] = useState<Task[]>([]);
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

  const activeTask = tasks[currentIndex];
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let interval: number | undefined;
    if (!isOnBreak && !isTaskPaused && !showNextPreview && !showBreakOffer) {
      interval = window.setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isOnBreak, isTaskPaused, showNextPreview, showBreakOffer]);

  useEffect(() => {
    setElapsedSeconds(0);
    setIsTaskPaused(false);
  }, [currentIndex]);

  const handleTaskCompletion = (photo?: string) => {
    const completedTask: Task = { 
      ...activeTask, 
      status: 'Completed' as any,
      actualMinutes: Math.floor(elapsedSeconds / 60)
    };

    setCompletedHistory([completedTask, ...completedHistory]);
    setUserLocationId(activeTask.locationId);
    
    if (currentIndex < tasks.length - 1) {
      setShowBreakOffer(true);
    } else {
      alert("Shift Tasks Completed!");
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

    // Add to task list after the current task
    setTasks(prev => {
      const next = [...prev];
      next.splice(currentIndex + 1, 0, newTask);
      return next;
    });

    // Add a notification
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
    setShowBreakOffer(false);
    setShowNextPreview(true);
    setShowNavigation(false);
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setShowNextPreview(false);
    }, 2000);
  };

  const renderHistory = () => (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
      <h2 className="text-xl font-bold text-gray-900 mb-6 px-1">Task History</h2>
      {completedHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <HistoryIcon size={48} className="mb-4 opacity-20" />
          <p className="text-sm font-medium">No tasks completed yet.</p>
        </div>
      ) : (
        <div className="space-y-3 pb-20">
          {completedHistory.map((task, idx) => (
            <div key={`${task.id}-${idx}`} className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-sm text-gray-900">{task.title}</h3>
                  <p className="text-[10px] text-blue-600 font-bold uppercase tracking-tight">{task.roomNumber}</p>
                </div>
                <div className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">
                  COMPLETED
                </div>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-gray-500 font-medium">
                <span className="flex items-center gap-1"><Clock size={12} /> {task.actualMinutes}m taken</span>
                <span className="flex items-center gap-1"><User size={12} /> {task.role}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTaskView = () => {
    if (isOnBreak) return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-white rounded-3xl shadow-sm border animate-in fade-in duration-300">
        <Coffee size={40} className="text-emerald-500 mb-6" />
        <h2 className="text-xl font-bold mb-2">On Break</h2>
        <p className="text-sm text-gray-400 mb-8">Enjoy your rest period.</p>
        <button onClick={() => setIsOnBreak(false)} className="w-full bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-100 active:scale-95 transition-all">RETURN TO DUTY</button>
      </div>
    );

    if (showBreakOffer) return (
      <div className="flex flex-col h-full animate-in zoom-in-95 p-6">
        <div className="flex-grow flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6"><Sparkles size={40} className="text-emerald-600" /></div>
          <h2 className="text-2xl font-black mb-1">Task Finished!</h2>
          <p className="text-sm text-gray-500 mb-8">Excellent work. Would you like to take a break or proceed?</p>
          <div className="w-full space-y-3">
             <button onClick={proceedToNextTask} className="w-full py-5 bg-[#2164f3] text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">Proceed to Next Task <ArrowRight size={20} /></button>
             <button onClick={() => { setShowBreakOffer(false); setIsOnBreak(true); }} className="w-full py-5 bg-white border-2 border-emerald-100 text-emerald-600 font-bold rounded-2xl active:scale-95 transition-all">Take a Break</button>
          </div>
        </div>
      </div>
    );

    if (showNextPreview) return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center animate-in fade-in">
        <Activity size={48} className="text-blue-500 animate-pulse mb-4" />
        <h2 className="text-xl font-bold mb-1">Getting Next Task...</h2>
      </div>
    );

    return (
      <TaskView 
        task={activeTask} 
        onComplete={handleTaskCompletion} 
        onCancel={() => proceedToNextTask()}
        onAddNote={handleAddNote}
        onRequestFollowUp={handleRequestFollowUp}
        showNavigation={showNavigation}
        onToggleNavigation={() => setShowNavigation(!showNavigation)}
        elapsedSeconds={elapsedSeconds}
        isPaused={isTaskPaused}
        onTogglePause={() => setIsTaskPaused(!isTaskPaused)}
        userLocationId={userLocationId}
      />
    );
  };

  return (
    <div className={`h-screen ${isDarkMode ? 'dark' : ''}`}>
      <div className="flex flex-col h-full bg-slate-50 max-w-md mx-auto relative overflow-hidden font-sans">
        <header className="flex flex-col flex-shrink-0 z-30 shadow-lg">
          <div className="bg-[#2164f3] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div onClick={() => setCurrentView('profile')} className="w-10 h-10 rounded-full bg-white/20 border border-white/40 flex items-center justify-center font-bold shadow-sm cursor-pointer">NH</div>
              <div className="flex flex-col">
                <h1 className="text-lg font-black uppercase tracking-tight">Service IQ</h1>
                <h2 className="text-[9px] font-bold text-white/80 uppercase tracking-widest">HCA Florida Mercy</h2>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setCurrentView('notifications')} className="relative p-1">
                <Bell size={20} />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-600 rounded-full border-2 border-[#2164f3]" />}
              </button>
              <button onClick={() => setCurrentView('settings')}><Settings size={20} /></button>
            </div>
          </div>
          <div className="bg-[#1a54cc] text-white px-5 py-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
            <div className="flex items-center gap-1.5"><Activity size={12} className="text-emerald-400" /> System Active</div>
            <div className="flex items-center gap-1 opacity-70"><Clock size={12} /> {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toUpperCase()}</div>
          </div>
        </header>

        <main className="flex-grow overflow-y-auto p-4">
          {currentView === 'history' ? renderHistory() : 
           currentView === 'profile' ? <div className="p-8 text-center text-gray-400"><User size={48} className="mx-auto mb-4 opacity-20" /><p>Profile Coming Soon</p></div> : 
           currentView === 'settings' ? <div className="p-8 text-center text-gray-400"><Settings size={48} className="mx-auto mb-4 opacity-20" /><p>Settings Coming Soon</p></div> : 
           currentView === 'notifications' ? <div className="p-8 text-center text-gray-400"><BellRing size={48} className="mx-auto mb-4 opacity-20" /><p>No new notifications</p></div> : 
           renderTaskView()}
        </main>

        <nav className="bg-white border-t px-8 py-2 flex justify-between items-center h-16 flex-shrink-0 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <button onClick={() => setCurrentView('task')} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'task' ? 'text-[#2164f3]' : 'text-gray-300'}`}><Activity size={20} /><span className="text-[9px] font-bold uppercase">Tasks</span></button>
          <button onClick={() => setCurrentView('history')} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'history' ? 'text-[#2164f3]' : 'text-gray-300'}`}><HistoryIcon size={20} /><span className="text-[9px] font-bold uppercase">History</span></button>
          <button onClick={() => setCurrentView('profile')} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'profile' ? 'text-[#2164f3]' : 'text-gray-300'}`}><User size={20} /><span className="text-[9px] font-bold uppercase">Me</span></button>
        </nav>
      </div>
    </div>
  );
};

export default App;
