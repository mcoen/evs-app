
import React from 'react';
import { LOCATIONS, ROTATIONAL_PATH } from '../constants';
import { HospitalLocation, EmployeeRole } from '../types';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';

interface FloorMapProps {
  currentLocationId: string;
  destinationLocationId: string;
  userRole?: EmployeeRole;
  rotationIndex?: number;
}

const FloorMap: React.FC<FloorMapProps> = ({ currentLocationId, destinationLocationId, userRole, rotationIndex = 0 }) => {
  const current = LOCATIONS.find(l => l.id === currentLocationId) || LOCATIONS[0];
  const dest = LOCATIONS.find(l => l.id === destinationLocationId) || LOCATIONS[0];
  const isEDRole = userRole === EmployeeRole.ED_EVS;

  // Filter locations for ED if it's an ED role
  const mapLocations = isEDRole 
    ? LOCATIONS.filter(l => l.id.startsWith('ED_'))
    : LOCATIONS.filter(l => !l.id.startsWith('ED_'));

  return (
    <div className="relative w-full h-64 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 overflow-hidden mb-4 shadow-inner">
      <svg viewBox={isEDRole ? "0 0 200 120" : "0 0 200 200"} className="w-full h-full">
        {/* Floor Outline */}
        <rect x="5" y="5" width="190" height={isEDRole ? 110 : 190} fill="currentColor" className="text-slate-50 dark:text-slate-950" stroke="#e2e8f0" strokeWidth="1" />
        
        {/* Hallways */}
        <rect x="20" y="25" width="160" height={isEDRole ? 70 : 150} fill="currentColor" className="text-white dark:text-slate-900" />
        
        {/* Rotational Path for ED */}
        {isEDRole && (
          <polyline
            points={ROTATIONAL_PATH.map(id => {
              const loc = LOCATIONS.find(l => l.id === id);
              return loc ? `${loc.x},${loc.y}` : '';
            }).filter(p => p !== '').join(' ') + ` ${LOCATIONS.find(l => l.id === ROTATIONAL_PATH[0])?.x},${LOCATIONS.find(l => l.id === ROTATIONAL_PATH[0])?.y}`}
            fill="none"
            stroke="#2164f3"
            strokeWidth="0.5"
            strokeDasharray="2 2"
            opacity="0.15"
          />
        )}

        {/* Room Markers */}
        {mapLocations.map((loc) => {
          const isRotationalBay = ROTATIONAL_PATH.includes(loc.id);
          const bayIndex = ROTATIONAL_PATH.indexOf(loc.id);
          const isCleaned = isEDRole && isRotationalBay && bayIndex < rotationIndex;
          const isCurrent = isEDRole && isRotationalBay && bayIndex === rotationIndex;
          
          let markerColor = 'text-slate-200 dark:text-slate-800';
          if (isRotationalBay) {
            markerColor = isCleaned ? 'text-emerald-500' : isCurrent ? 'text-blue-500' : 'text-rose-500';
          }

          const radius = isRotationalBay ? 10 : 2;

          return (
            <g key={loc.id}>
              {/* Marker Circle */}
              <circle 
                cx={loc.x} 
                cy={loc.y} 
                r={radius} 
                fill="currentColor" 
                className={`${markerColor} ${isCurrent ? 'animate-pulse' : ''}`} 
              />
              
              {/* Status Icon for ED Bays */}
              {isRotationalBay && (
                <g transform={`translate(${loc.x - 5}, ${loc.y - 5}) scale(0.42)`}>
                  {isCleaned ? (
                    <path d="M20 6L9 17l-5-5" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  ) : isCurrent ? (
                    <circle cx="12" cy="12" r="10" fill="none" stroke="white" strokeWidth="4" />
                  ) : (
                    <path d="M12 8v4m0 4h.01M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z" fill="none" stroke="white" strokeWidth="4" />
                  )}
                </g>
              )}

              <text x={loc.x} y={loc.y - (radius + 2)} fontSize="3.5" fill="currentColor" className="text-slate-400 font-bold uppercase tracking-tighter" textAnchor="middle">
                {loc.name.replace('ED ', '')}
              </text>
              
              {isEDRole && isRotationalBay && (
                <text x={loc.x} y={loc.y + 2.5} fontSize="3.5" fill="white" className="font-black opacity-40" textAnchor="middle">
                  {bayIndex + 1}
                </text>
              )}
            </g>
          );
        })}

        {/* Navigation Path */}
        {current && dest && current.id !== dest.id && (
          <path
            d={`M ${current.x} ${current.y} L ${dest.x} ${dest.y}`}
            fill="none"
            stroke="#2164f3"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            className="animate-[dash_2s_linear_infinite]"
          />
        )}

        {/* Current Position Marker */}
        <circle cx={current.x} cy={current.y} r="5" fill="#2164f3" className="animate-pulse shadow-xl">
          <title>Your Position</title>
        </circle>
        
        {/* Destination Marker */}
        <path 
          d={`M ${dest.x} ${dest.y-6} L ${dest.x-3} ${dest.y-10} L ${dest.x+3} ${dest.y-10} Z`} 
          fill="#ef4444" 
        />
        <circle cx={dest.x} cy={dest.y} r="4" fill="none" stroke="#ef4444" strokeWidth="1" />
      </svg>
      
      <div className="absolute bottom-2 right-2 bg-white/80 dark:bg-slate-900/80 px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest text-slate-500 shadow-sm border border-slate-100">
        {isEDRole ? 'Emergency Department - Ground' : 'Level 4 East Wing'}
      </div>

      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: -12; }
        }
      `}</style>
    </div>
  );
};

export default FloorMap;
