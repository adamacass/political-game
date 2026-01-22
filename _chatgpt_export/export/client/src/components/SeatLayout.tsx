import React from 'react';
import { Player } from '../types';

interface SeatLayoutProps {
  players: Player[];
  totalSeats: number;
  speakerId?: string;
}

export function SeatLayout({ players, totalSeats, speakerId }: SeatLayoutProps) {
  // Sort players by seats descending to determine government vs opposition
  const sortedPlayers = [...players].sort((a, b) => b.seats - a.seats);
  const governmentParty = sortedPlayers[0];
  const oppositionParties = sortedPlayers.slice(1);
  
  // Calculate seat positions in a hemicycle
  const generateHemicycleSeats = () => {
    const seats: { x: number; y: number; playerId: string; color: string; isLeader: boolean }[] = [];
    
    // We'll create multiple rows in a semi-circle
    // Row configuration: inner rows have fewer seats
    const rows = [
      { radius: 120, seatCount: Math.min(12, Math.ceil(totalSeats * 0.15)) },
      { radius: 150, seatCount: Math.min(16, Math.ceil(totalSeats * 0.2)) },
      { radius: 180, seatCount: Math.min(20, Math.ceil(totalSeats * 0.25)) },
      { radius: 210, seatCount: Math.min(24, Math.ceil(totalSeats * 0.25)) },
      { radius: 240, seatCount: totalSeats }, // Overflow row
    ];
    
    // Assign seats to players
    let assignedSeats = 0;
    const playerSeats: { playerId: string; color: string; isLeader: boolean }[] = [];
    
    players.forEach((player, idx) => {
      const isLeader = idx === 0;
      for (let i = 0; i < player.seats; i++) {
        playerSeats.push({ playerId: player.id, color: player.color, isLeader: isLeader && i === 0 });
      }
    });
    
    // Distribute seats across rows
    let seatIndex = 0;
    const centerX = 250;
    const centerY = 240;
    
    for (const row of rows) {
      if (seatIndex >= totalSeats) break;
      
      const seatsInThisRow = Math.min(row.seatCount, totalSeats - seatIndex);
      const angleStart = Math.PI * 0.1; // Start angle (slightly past horizontal)
      const angleEnd = Math.PI * 0.9; // End angle (slightly before horizontal)
      const angleStep = (angleEnd - angleStart) / (seatsInThisRow - 1 || 1);
      
      for (let i = 0; i < seatsInThisRow; i++) {
        if (seatIndex >= playerSeats.length) break;
        
        const angle = angleStart + i * angleStep;
        const x = centerX + row.radius * Math.cos(angle);
        const y = centerY - row.radius * Math.sin(angle);
        
        seats.push({
          x,
          y,
          ...playerSeats[seatIndex],
        });
        seatIndex++;
      }
    }
    
    return seats;
  };
  
  const seats = generateHemicycleSeats();
  
  // Group seats by player for legend
  const seatCounts = players.map(p => ({ 
    name: p.name, 
    seats: p.seats, 
    color: p.color,
    percentage: Math.round((p.seats / totalSeats) * 100)
  }));

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-3 text-center">Parliament</h3>
      
      {/* SVG Hemicycle */}
      <div className="relative">
        <svg viewBox="0 0 500 280" className="w-full h-auto">
          {/* Background arc */}
          <path
            d="M 50 250 A 200 200 0 0 1 450 250"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="2"
          />
          
          {/* Center table/dispatch box */}
          <rect x="200" y="230" width="100" height="30" rx="5" fill="#374151" />
          <text x="250" y="250" textAnchor="middle" fill="white" fontSize="10">
            Dispatch
          </text>
          
          {/* Speaker's chair */}
          <rect x="225" y="260" width="50" height="15" rx="3" fill="#1e40af" />
          <text x="250" y="272" textAnchor="middle" fill="white" fontSize="8">
            Speaker
          </text>
          
          {/* Seat dots */}
          {seats.map((seat, idx) => (
            <g key={idx}>
              <circle
                cx={seat.x}
                cy={seat.y}
                r={seat.isLeader ? 8 : 6}
                fill={seat.color}
                stroke={seat.isLeader ? '#fbbf24' : '#fff'}
                strokeWidth={seat.isLeader ? 3 : 1}
                className="transition-all duration-200"
              />
              {seat.isLeader && (
                <text
                  x={seat.x}
                  y={seat.y + 3}
                  textAnchor="middle"
                  fill="white"
                  fontSize="8"
                  fontWeight="bold"
                >
                  ★
                </text>
              )}
            </g>
          ))}
          
          {/* Government side label */}
          <text x="100" y="270" textAnchor="middle" fill="#374151" fontSize="10" fontWeight="bold">
            Opposition
          </text>
          
          {/* Opposition side label */}
          <text x="400" y="270" textAnchor="middle" fill="#374151" fontSize="10" fontWeight="bold">
            Government
          </text>
        </svg>
      </div>
      
      {/* Legend */}
      <div className="mt-4 space-y-2">
        {seatCounts.map((party, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: party.color }}
              />
              <span className="text-sm font-medium">{party.name}</span>
              {idx === 0 && (
                <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                  Gov
                </span>
              )}
            </div>
            <div className="text-sm text-gray-600">
              {party.seats} seats ({party.percentage}%)
            </div>
          </div>
        ))}
        
        {/* Majority indicator */}
        <div className="pt-2 border-t mt-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Majority needed:</span>
            <span className="font-medium">{Math.floor(totalSeats / 2) + 1}</span>
          </div>
          {governmentParty && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Government seats:</span>
              <span className={`font-medium ${governmentParty.seats > totalSeats / 2 ? 'text-green-600' : 'text-orange-600'}`}>
                {governmentParty.seats} {governmentParty.seats > totalSeats / 2 ? '(Majority)' : '(Minority)'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact version for sidebar
export function SeatLayoutCompact({ players, totalSeats }: SeatLayoutProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <h4 className="text-sm font-semibold mb-2">Seat Distribution</h4>
      
      {/* Stacked bar */}
      <div className="h-6 rounded-full overflow-hidden flex mb-2">
        {players.map((player, idx) => {
          const width = (player.seats / totalSeats) * 100;
          return (
            <div
              key={idx}
              className="h-full transition-all duration-300"
              style={{ 
                width: `${width}%`, 
                backgroundColor: player.color,
                minWidth: player.seats > 0 ? '8px' : '0'
              }}
              title={`${player.name}: ${player.seats} seats`}
            />
          );
        })}
      </div>
      
      {/* Labels */}
      <div className="flex flex-wrap gap-2">
        {players.map((player, idx) => (
          <div key={idx} className="flex items-center gap-1 text-xs">
            <div 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: player.color }}
            />
            <span>{player.seats}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
