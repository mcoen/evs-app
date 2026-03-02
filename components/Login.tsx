import React, { useState } from 'react';
import { User, EmployeeRole } from '../types';
import { MOCK_USERS } from '../constants';
import { Shield, ArrowRight, User as UserIcon, Lock, Loader2, Hospital } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<EmployeeRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    
    setIsLoading(true);
    // Simulate network delay
    setTimeout(() => {
      const user = MOCK_USERS.find(u => u.role === selectedRole);
      if (user) {
        onLogin(user);
      }
      setIsLoading(false);
    }, 1500);
  };

  const roleIcons: Record<EmployeeRole, React.ReactNode> = {
    [EmployeeRole.EVS]: <Shield className="text-blue-500" size={24} />,
    [EmployeeRole.TRANSPORTER]: <ArrowRight className="text-emerald-500" size={24} />,
    [EmployeeRole.ENGINEERING]: <Lock className="text-amber-500" size={24} />,
    [EmployeeRole.BIOMED]: <UserIcon className="text-purple-500" size={24} />,
    [EmployeeRole.ED_EVS]: <Hospital className="text-rose-500" size={24} />,
  };

  return (
    <div className="h-full flex items-center justify-center p-4 font-sans overflow-hidden">
      <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center mb-2">
            <img 
              src="https://www.michaelcoen.com/images/TeleTrackingWhiteLogo.png" 
              alt="TeleTracking Logo" 
              className="h-12 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">Service IQ</h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">HCA Florida Mercy • Secure Access</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[2rem] p-5 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Select Department</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(EmployeeRole).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className={`flex flex-col items-center justify-center p-2 rounded-2xl border-2 transition-all active:scale-95 ${
                      selectedRole === role
                        ? 'bg-blue-600/10 border-blue-600 shadow-lg shadow-blue-600/10'
                        : 'bg-slate-800/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="mb-1 scale-75">{roleIcons[role]}</div>
                    <span className={`text-[8px] font-black uppercase tracking-tight text-center ${
                      selectedRole === role ? 'text-blue-400' : 'text-slate-400'
                    }`}>
                      {role.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Employee PIN</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••"
                className="w-full bg-slate-800/50 border-2 border-slate-800 rounded-xl px-3 py-2 text-white text-center text-xl tracking-[0.5em] focus:border-blue-600 outline-none transition-all placeholder:text-slate-700"
                maxLength={4}
              />
            </div>

            <button
              type="submit"
              disabled={!selectedRole || isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-black py-3 rounded-xl shadow-xl shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center">
          <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">
            Authorized Personnel Only • System ID: MERCY-IQ-09
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
