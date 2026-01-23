/**
 * MySeatsList Component
 *
 * Displays a compact, collapsible list of seats owned by the current player.
 * Shows seat name, state, and ideology information.
 */

import React, { useState, useMemo } from 'react';
import { Seat, SeatId, StateCode, EconBucket, SocialBucket } from '../types';
import { ChevronDown, ChevronUp, MapPin, Filter } from 'lucide-react';

interface MySeatsListProps {
  seats: Record<SeatId, Seat>;
  playerId: string;
  playerColor: string;
}

// Ideology bucket display helpers
const ECON_LABELS: Record<EconBucket, { label: string; color: string }> = {
  LEFT: { label: 'Left', color: 'bg-blue-100 text-blue-700' },
  CENTER: { label: 'Center', color: 'bg-gray-100 text-gray-700' },
  RIGHT: { label: 'Right', color: 'bg-yellow-100 text-yellow-700' },
};

const SOCIAL_LABELS: Record<SocialBucket, { label: string; color: string }> = {
  PROG: { label: 'Prog', color: 'bg-purple-100 text-purple-700' },
  CENTER: { label: 'Center', color: 'bg-gray-100 text-gray-700' },
  CONS: { label: 'Cons', color: 'bg-red-100 text-red-700' },
};

const STATE_FULL_NAMES: Record<StateCode, string> = {
  NSW: 'New South Wales',
  VIC: 'Victoria',
  QLD: 'Queensland',
  WA: 'Western Australia',
  SA: 'South Australia',
  TAS: 'Tasmania',
  ACT: 'Australian Capital Territory',
  NT: 'Northern Territory',
};

export function MySeatsList({ seats, playerId, playerColor }: MySeatsListProps) {
  const [expanded, setExpanded] = useState(false);
  const [stateFilter, setStateFilter] = useState<StateCode | 'ALL'>('ALL');
  const [econFilter, setEconFilter] = useState<EconBucket | 'ALL'>('ALL');
  const [socialFilter, setSocialFilter] = useState<SocialBucket | 'ALL'>('ALL');

  // Get seats owned by current player
  const mySeats = useMemo(() => {
    return Object.values(seats)
      .filter(s => s.ownerPlayerId === playerId)
      .sort((a, b) => {
        // Sort by state, then by name
        if (a.state !== b.state) return a.state.localeCompare(b.state);
        return a.name.localeCompare(b.name);
      });
  }, [seats, playerId]);

  // Filter seats
  const filteredSeats = useMemo(() => {
    return mySeats.filter(s => {
      if (stateFilter !== 'ALL' && s.state !== stateFilter) return false;
      if (econFilter !== 'ALL' && s.ideology.econ !== econFilter) return false;
      if (socialFilter !== 'ALL' && s.ideology.social !== socialFilter) return false;
      return true;
    });
  }, [mySeats, stateFilter, econFilter, socialFilter]);

  // Compute ideology summary
  const ideologySummary = useMemo(() => {
    const econ: Record<EconBucket, number> = { LEFT: 0, CENTER: 0, RIGHT: 0 };
    const social: Record<SocialBucket, number> = { PROG: 0, CENTER: 0, CONS: 0 };

    mySeats.forEach(s => {
      econ[s.ideology.econ]++;
      social[s.ideology.social]++;
    });

    return { econ, social };
  }, [mySeats]);

  // Compute state breakdown
  const stateBreakdown = useMemo(() => {
    const counts: Partial<Record<StateCode, number>> = {};
    mySeats.forEach(s => {
      counts[s.state] = (counts[s.state] || 0) + 1;
    });
    return counts;
  }, [mySeats]);

  const hasFilters = stateFilter !== 'ALL' || econFilter !== 'ALL' || socialFilter !== 'ALL';

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-lg"
        style={{ borderLeft: `4px solid ${playerColor}` }}
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4" style={{ color: playerColor }} />
          <span className="font-semibold">My Seats</span>
          <span className="text-sm text-gray-500">({mySeats.length})</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100">
          {/* Ideology summary */}
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-gray-500 mb-1">Economic</div>
              <div className="flex gap-1">
                {(['LEFT', 'CENTER', 'RIGHT'] as EconBucket[]).map(bucket => (
                  <span
                    key={bucket}
                    className={`px-1.5 py-0.5 rounded ${ECON_LABELS[bucket].color}`}
                  >
                    {ECON_LABELS[bucket].label}: {ideologySummary.econ[bucket]}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Social</div>
              <div className="flex gap-1">
                {(['PROG', 'CENTER', 'CONS'] as SocialBucket[]).map(bucket => (
                  <span
                    key={bucket}
                    className={`px-1.5 py-0.5 rounded ${SOCIAL_LABELS[bucket].color}`}
                  >
                    {SOCIAL_LABELS[bucket].label}: {ideologySummary.social[bucket]}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-3 flex flex-wrap gap-2 items-center text-xs">
            <Filter className="w-3 h-3 text-gray-400" />
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as StateCode | 'ALL')}
              className="px-2 py-1 border rounded text-xs"
            >
              <option value="ALL">All States</option>
              {Object.entries(stateBreakdown).map(([state, count]) => (
                <option key={state} value={state}>
                  {state} ({count})
                </option>
              ))}
            </select>
            <select
              value={econFilter}
              onChange={(e) => setEconFilter(e.target.value as EconBucket | 'ALL')}
              className="px-2 py-1 border rounded text-xs"
            >
              <option value="ALL">All Econ</option>
              <option value="LEFT">Left</option>
              <option value="CENTER">Center</option>
              <option value="RIGHT">Right</option>
            </select>
            <select
              value={socialFilter}
              onChange={(e) => setSocialFilter(e.target.value as SocialBucket | 'ALL')}
              className="px-2 py-1 border rounded text-xs"
            >
              <option value="ALL">All Social</option>
              <option value="PROG">Progressive</option>
              <option value="CENTER">Center</option>
              <option value="CONS">Conservative</option>
            </select>
            {hasFilters && (
              <button
                onClick={() => {
                  setStateFilter('ALL');
                  setEconFilter('ALL');
                  setSocialFilter('ALL');
                }}
                className="text-blue-600 hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Seat list */}
          <div className="mt-3 max-h-48 overflow-y-auto">
            {filteredSeats.length === 0 ? (
              <div className="text-center text-gray-400 py-4 text-sm">
                {hasFilters ? 'No seats match filters' : 'No seats owned'}
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-gray-500 border-b">
                  <tr>
                    <th className="text-left py-1 font-medium">Seat</th>
                    <th className="text-left py-1 font-medium">State</th>
                    <th className="text-center py-1 font-medium">Econ</th>
                    <th className="text-center py-1 font-medium">Social</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSeats.map(seat => (
                    <tr
                      key={seat.id}
                      className="border-b border-gray-50 hover:bg-gray-50"
                    >
                      <td className="py-1.5 truncate max-w-[100px]" title={seat.name}>
                        {seat.name}
                      </td>
                      <td className="py-1.5 text-gray-500">{seat.state}</td>
                      <td className="py-1.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${ECON_LABELS[seat.ideology.econ].color}`}
                        >
                          {ECON_LABELS[seat.ideology.econ].label}
                        </span>
                      </td>
                      <td className="py-1.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${SOCIAL_LABELS[seat.ideology.social].color}`}
                        >
                          {SOCIAL_LABELS[seat.ideology.social].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* State breakdown */}
          <div className="mt-3 pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-1">By State:</div>
            <div className="flex flex-wrap gap-1 text-xs">
              {Object.entries(stateBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([state, count]) => (
                  <span
                    key={state}
                    className="px-1.5 py-0.5 bg-gray-100 rounded"
                  >
                    {state}: {count}
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
