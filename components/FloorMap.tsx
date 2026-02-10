
import React from 'react';
import { LOCATIONS } from '../constants';
import { HospitalLocation } from '../types';

interface FloorMapProps {
  currentLocationId: string;
  destinationLocationId: string;
}

const FloorMap: React.FC<FloorMapProps> = ({ currentLocationId, destinationLocationId }) => {
  const current = LOCATIONS.find(l => l.id === currentLocationId) || LOCATIONS[0];
  const dest = LOCATIONS.find(l => l.id === destinationLocationId) || LOCATIONS[0];

  return (
    <div className="relative w-full h-48 bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden mb-4 shadow-inner">
      <svg viewBox="0 0 200 120" className="w-full h-full">
        {/* Floor Outline */}
        <rect x="10" y="10" width="180" height="100" fill="currentColor" className="text-white dark:text-slate-900" stroke="currentColor" strokeWidth="1" />
        
        {/* Hallway */}
        <rect x="40" y="25" width="120" height="70" fill="currentColor" className="text-slate-50 dark:text-slate-800/50" />
        
        {/* Room Lines */}
        {LOCATIONS.map((loc) => (
          <g key={loc.id}>
            <circle cx={loc.x} cy={loc.y} r="3" fill="currentColor" className="text-slate-300 dark:text-slate-700" />
            <text x={loc.x} y={loc.y - 5} fontSize="4" fill="currentColor" className="text-slate-500 dark:text-slate-500" textAnchor="middle">{loc.name}</text>
          </g>
        ))}

        {/* Navigation Path */}
        {current && dest && current.id !== dest.id && (
          <path
            d={`M ${current.x} ${current.y} L ${dest.x} ${dest.y}`}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="4 2"
            className="animate-[dash_2s_linear_infinite]"
          />
        )}

        {/* Current Position Marker */}
        <circle cx={current.x} cy={current.y} r="5" fill="#10b981" className="animate-pulse">
          <title>Your Position</title>
        </circle>
        
        {/* Destination Marker */}
        <path 
          d={`M ${dest.x} ${dest.y-6} L ${dest.x-3} ${dest.y-10} L ${dest.x+3} ${dest.y-10} Z`} 
          fill="#ef4444" 
        />
        <circle cx={dest.x} cy={dest.y} r="4" fill="none" stroke="#ef4444" strokeWidth="1" />
      </svg>
      
      <div className="absolute bottom-2 right-2 bg-white dark:bg-slate-700 px-2 py-1 rounded text-[10px] font-medium text-gray-500 dark:text-slate-300 shadow-sm border dark:border-slate-600">
        Level 4 East Wing
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
