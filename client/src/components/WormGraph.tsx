import React, { useState, useMemo } from 'react';
import { HistorySnapshot, Player } from '../types';
import { X } from 'lucide-react';

interface WormGraphProps {
  history: HistorySnapshot[];
  players: Player[];
  totalSeats: number;
  currentRound: number;
}

export function WormGraph({ history, players, totalSeats, currentRound }: WormGraphProps) {
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [hoveredRound, setHoveredRound] = useState<number | null>(null);

  // Graph dimensions
  const width = 600;
  const height = 250;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const { xScale, yScale, yMax, yMin } = useMemo(() => {
    const rounds = history.length > 0 ? history.length : 1;
    const xScale = (round: number) => padding.left + ((round - 1) / Math.max(rounds - 1, 1)) * graphWidth;
    
    // Find min/max seats across all history
    let minSeats = totalSeats;
    let maxSeats = 0;
    
    history.forEach(snapshot => {
      Object.values(snapshot.seatCounts).forEach(seats => {
        minSeats = Math.min(minSeats, seats);
        maxSeats = Math.max(maxSeats, seats);
      });
    });
    
    // Add some padding to Y axis
    const yPadding = Math.max(5, Math.ceil((maxSeats - minSeats) * 0.1));
    const yMin = Math.max(0, minSeats - yPadding);
    const yMax = maxSeats + yPadding;
    
    const yScale = (seats: number) => {
      const normalized = (seats - yMin) / (yMax - yMin);
      return padding.top + graphHeight * (1 - normalized);
    };
    
    return { xScale, yScale, yMax, yMin };
  }, [history, totalSeats, graphWidth, graphHeight, padding]);

  // Generate path data for each player
  const playerPaths = useMemo(() => {
    if (history.length === 0) return [];
    
    return players.map(player => {
      const points = history.map((snapshot, idx) => {
        const seats = snapshot.seatCounts[player.id] ?? 0;
        const x = xScale(idx + 1);
        const y = yScale(seats);
        return { x, y, round: snapshot.round, seats };
      });
      
      const pathData = points.map((p, i) => 
        `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
      ).join(' ');
      
      return {
        playerId: player.id,
        playerName: player.name,
        color: player.color,
        pathData,
        points,
      };
    });
  }, [history, players, xScale, yScale]);

  // Get snapshot details for tooltip
  const activeSnapshot = selectedRound 
    ? history.find(h => h.round === selectedRound)
    : hoveredRound 
      ? history.find(h => h.round === hoveredRound)
      : null;

  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name || 'Unknown';
  };

  const formatIssue = (issue: string) => {
    return issue.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  if (history.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-2">Polling Worm</h3>
        <div className="h-40 flex items-center justify-center text-gray-400">
          No round data yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">Polling Worm</h3>
        <span className="text-sm text-gray-500">
          Click a round for details
        </span>
      </div>
      
      <div className="relative">
        <svg width={width} height={height} className="w-full h-auto">
          {/* Grid lines */}
          <g className="grid">
            {/* Horizontal grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(pct => {
              const y = padding.top + graphHeight * pct;
              const value = Math.round(yMax - (yMax - yMin) * pct);
              return (
                <g key={pct}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="#e5e7eb"
                    strokeDasharray="4,4"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="#9ca3af"
                  >
                    {value}
                  </text>
                </g>
              );
            })}
            
            {/* Majority line */}
            {(() => {
              const majoritySeats = Math.floor(totalSeats / 2) + 1;
              if (majoritySeats >= yMin && majoritySeats <= yMax) {
                const y = yScale(majoritySeats);
                return (
                  <g>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeDasharray="8,4"
                    />
                    <text
                      x={width - padding.right + 4}
                      y={y + 4}
                      fontSize="10"
                      fill="#f59e0b"
                      fontWeight="bold"
                    >
                      Majority
                    </text>
                  </g>
                );
              }
              return null;
            })()}
          </g>
          
          {/* Round markers (X axis) */}
          <g className="x-axis">
            {history.map((snapshot, idx) => {
              const x = xScale(idx + 1);
              const isActive = snapshot.round === selectedRound || snapshot.round === hoveredRound;
              return (
                <g key={snapshot.round}>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={height - padding.bottom}
                    stroke={isActive ? '#3b82f6' : '#e5e7eb'}
                    strokeWidth={isActive ? 2 : 1}
                  />
                  <text
                    x={x}
                    y={height - padding.bottom + 16}
                    textAnchor="middle"
                    fontSize="10"
                    fill={isActive ? '#3b82f6' : '#9ca3af'}
                    fontWeight={isActive ? 'bold' : 'normal'}
                  >
                    R{snapshot.round}
                  </text>
                </g>
              );
            })}
          </g>
          
          {/* Player lines */}
          {playerPaths.map(({ playerId, color, pathData }) => (
            <path
              key={playerId}
              d={pathData}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          
          {/* Data points (clickable) */}
          {playerPaths.map(({ playerId, color, points }) => (
            <g key={`points-${playerId}`}>
              {points.map((point, idx) => (
                <circle
                  key={idx}
                  cx={point.x}
                  cy={point.y}
                  r={point.round === selectedRound || point.round === hoveredRound ? 6 : 4}
                  fill={color}
                  stroke="white"
                  strokeWidth="2"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredRound(point.round)}
                  onMouseLeave={() => setHoveredRound(null)}
                  onClick={() => setSelectedRound(selectedRound === point.round ? null : point.round)}
                />
              ))}
            </g>
          ))}
          
          {/* Y-axis label */}
          <text
            x={12}
            y={height / 2}
            transform={`rotate(-90, 12, ${height / 2})`}
            textAnchor="middle"
            fontSize="11"
            fill="#6b7280"
          >
            Seats
          </text>
        </svg>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {players.map(player => (
            <div key={player.id} className="flex items-center gap-1 text-sm">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: player.color }}
              />
              <span>{player.name}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Round detail panel */}
      {activeSnapshot && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border relative">
          {selectedRound && (
            <button
              onClick={() => setSelectedRound(null)}
              className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-semibold">Round {activeSnapshot.round}</h4>
            <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
              {formatIssue(activeSnapshot.activeIssue)}
            </span>
          </div>
          
          {/* Seat counts */}
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">Seats at end of round:</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(activeSnapshot.seatCounts).map(([playerId, seats]) => {
                const player = players.find(p => p.id === playerId);
                return (
                  <span 
                    key={playerId}
                    className="px-2 py-1 rounded text-sm font-medium text-white"
                    style={{ backgroundColor: player?.color || '#666' }}
                  >
                    {player?.name}: {seats}
                  </span>
                );
              })}
            </div>
          </div>
          
          {/* Campaigns */}
          {activeSnapshot.campaignsPlayed.length > 0 && (
            <div className="mb-2">
              <div className="text-xs text-gray-500 mb-1">Campaigns:</div>
              <div className="space-y-1">
                {activeSnapshot.campaignsPlayed.map((campaign, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="font-medium">{getPlayerName(campaign.playerId)}</span>
                    {' played '}
                    <span className="italic">{campaign.cardName}</span>
                    {' → '}
                    <span className={campaign.seatDelta >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {campaign.seatDelta >= 0 ? '+' : ''}{campaign.seatDelta} seats
                    </span>
                    {campaign.agendaBonus > 0 && (
                      <span className="text-blue-600 ml-1">(+{campaign.agendaBonus} agenda)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Policy */}
          {activeSnapshot.policyResult && (
            <div className="mb-2">
              <div className="text-xs text-gray-500 mb-1">Policy:</div>
              <div className="text-sm">
                <span className="font-medium">{getPlayerName(activeSnapshot.policyResult.proposerId)}</span>
                {' proposed '}
                <span className="italic">{activeSnapshot.policyResult.cardName}</span>
                {' → '}
                <span className={activeSnapshot.policyResult.passed ? 'text-green-600 font-medium' : 'text-red-600'}>
                  {activeSnapshot.policyResult.passed ? 'PASSED' : 'FAILED'}
                </span>
                <span className="text-gray-500 ml-1">
                  ({activeSnapshot.policyResult.yesVotes}-{activeSnapshot.policyResult.noVotes})
                </span>
              </div>
            </div>
          )}
          
          {/* Wildcard */}
          {activeSnapshot.wildcardDrawn && (
            <div className="mb-2">
              <div className="text-xs text-gray-500 mb-1">Wildcard:</div>
              <div className="text-sm">
                <span className="italic">{activeSnapshot.wildcardDrawn.cardName}</span>
                {activeSnapshot.wildcardDrawn.effects.map((effect, idx) => (
                  <span key={idx} className="ml-2">
                    {getPlayerName(effect.playerId)}: 
                    <span className={effect.seatDelta >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {' '}{effect.seatDelta >= 0 ? '+' : ''}{effect.seatDelta}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Issue change */}
          {activeSnapshot.issueAdjustment && (
            <div className="text-sm text-gray-600">
              Agenda changed: {formatIssue(activeSnapshot.issueAdjustment.from)} → {formatIssue(activeSnapshot.issueAdjustment.to)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Compact version for sidebar
export function WormGraphMini({ history, players, totalSeats }: Omit<WormGraphProps, 'currentRound'>) {
  const width = 200;
  const height = 80;
  const padding = { top: 5, right: 5, bottom: 5, left: 5 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const { xScale, yScale } = useMemo(() => {
    const rounds = history.length > 0 ? history.length : 1;
    const xScale = (round: number) => padding.left + ((round - 1) / Math.max(rounds - 1, 1)) * graphWidth;
    
    let minSeats = totalSeats;
    let maxSeats = 0;
    
    history.forEach(snapshot => {
      Object.values(snapshot.seatCounts).forEach(seats => {
        minSeats = Math.min(minSeats, seats);
        maxSeats = Math.max(maxSeats, seats);
      });
    });
    
    const yPadding = Math.max(2, (maxSeats - minSeats) * 0.1);
    const yMin = Math.max(0, minSeats - yPadding);
    const yMax = maxSeats + yPadding;
    
    const yScale = (seats: number) => {
      const normalized = (seats - yMin) / (yMax - yMin);
      return padding.top + graphHeight * (1 - normalized);
    };
    
    return { xScale, yScale };
  }, [history, totalSeats, graphWidth, graphHeight, padding]);

  if (history.length === 0) {
    return (
      <div className="bg-gray-50 rounded p-2 h-20 flex items-center justify-center text-gray-400 text-xs">
        No data
      </div>
    );
  }

  return (
    <svg width={width} height={height} className="w-full h-auto">
      {players.map(player => {
        const points = history.map((snapshot, idx) => {
          const seats = snapshot.seatCounts[player.id] ?? 0;
          return `${idx === 0 ? 'M' : 'L'} ${xScale(idx + 1)} ${yScale(seats)}`;
        }).join(' ');
        
        return (
          <path
            key={player.id}
            d={points}
            fill="none"
            stroke={player.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}
