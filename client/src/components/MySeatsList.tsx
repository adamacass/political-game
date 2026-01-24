/**
 * MySeatsList Component
 *
 * Displays a compact, collapsible list of seats owned by the current player.
 * Shows seat name, state, and ideology information.
 */

import React, { useState, useMemo } from 'react';
import { Seat, SeatId, StateCode, EconBucket, SocialBucket } from '../types';
import { ChevronDown, ChevronUp, MapPin, Filter } from 'lucide-react';
import { SEAT_IDEOLOGY_COLORS } from '../constants/ideologyColors';

// Design tokens - ballot paper aesthetic
const colors = {
  paper1: '#F4F1E8',
  paper2: '#EEEBE2',
  paper3: '#E8E5DC',
  ink: '#111111',
  inkSecondary: '#3A3A3A',
  rule: '#1A1A1A',
};

interface MySeatsListProps {
  seats: Record<SeatId, Seat>;
  playerId: string;
  playerColor: string;
}

// Ideology bucket display helpers with soft red/blue spectrum
type IdeologyColorSet = { bg: string; text: string; border: string };

const ECON_LABELS: Record<EconBucket, { label: string; colors: IdeologyColorSet }> = {
  LEFT: { label: 'Left', colors: SEAT_IDEOLOGY_COLORS.LEFT },
  CENTER: { label: 'Center', colors: SEAT_IDEOLOGY_COLORS.CENTER },
  RIGHT: { label: 'Right', colors: SEAT_IDEOLOGY_COLORS.RIGHT },
};

const SOCIAL_LABELS: Record<SocialBucket, { label: string; colors: IdeologyColorSet }> = {
  PROG: { label: 'Prog', colors: SEAT_IDEOLOGY_COLORS.PROG },
  CENTER: { label: 'Center', colors: SEAT_IDEOLOGY_COLORS.CENTER },
  CONS: { label: 'Cons', colors: SEAT_IDEOLOGY_COLORS.CONS },
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
    <div className="rounded-lg" style={{ backgroundColor: colors.paper1, border: `2px solid ${colors.rule}` }}>
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between hover:opacity-90 transition-colors rounded-lg"
        style={{ borderLeft: `4px solid ${playerColor}` }}
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4" style={{ color: playerColor }} />
          <span className="font-semibold" style={{ color: colors.ink }}>My Seats</span>
          <span className="text-sm" style={{ color: colors.inkSecondary }}>({mySeats.length})</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4" style={{ color: colors.inkSecondary }} />
        ) : (
          <ChevronDown className="w-4 h-4" style={{ color: colors.inkSecondary }} />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3" style={{ borderTop: `1px solid ${colors.rule}` }}>
          {/* Ideology summary */}
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="mb-1" style={{ color: colors.inkSecondary }}>Economic</div>
              <div className="flex gap-1">
                {(['LEFT', 'CENTER', 'RIGHT'] as EconBucket[]).map(bucket => (
                  <span
                    key={bucket}
                    className="px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: ECON_LABELS[bucket].colors.bg,
                      color: ECON_LABELS[bucket].colors.text,
                      border: `1px solid ${ECON_LABELS[bucket].colors.border}`
                    }}
                  >
                    {ECON_LABELS[bucket].label}: {ideologySummary.econ[bucket]}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1" style={{ color: colors.inkSecondary }}>Social</div>
              <div className="flex gap-1">
                {(['PROG', 'CENTER', 'CONS'] as SocialBucket[]).map(bucket => (
                  <span
                    key={bucket}
                    className="px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: SOCIAL_LABELS[bucket].colors.bg,
                      color: SOCIAL_LABELS[bucket].colors.text,
                      border: `1px solid ${SOCIAL_LABELS[bucket].colors.border}`
                    }}
                  >
                    {SOCIAL_LABELS[bucket].label}: {ideologySummary.social[bucket]}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-3 flex flex-wrap gap-2 items-center text-xs">
            <Filter className="w-3 h-3" style={{ color: colors.inkSecondary }} />
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as StateCode | 'ALL')}
              className="px-2 py-1 rounded text-xs focus:outline-none"
              style={{ backgroundColor: colors.paper2, border: `1px solid ${colors.rule}`, color: colors.ink }}
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
              className="px-2 py-1 rounded text-xs focus:outline-none"
              style={{ backgroundColor: colors.paper2, border: `1px solid ${colors.rule}`, color: colors.ink }}
            >
              <option value="ALL">All Econ</option>
              <option value="LEFT">Left</option>
              <option value="CENTER">Center</option>
              <option value="RIGHT">Right</option>
            </select>
            <select
              value={socialFilter}
              onChange={(e) => setSocialFilter(e.target.value as SocialBucket | 'ALL')}
              className="px-2 py-1 rounded text-xs focus:outline-none"
              style={{ backgroundColor: colors.paper2, border: `1px solid ${colors.rule}`, color: colors.ink }}
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
                className="hover:underline"
                style={{ color: colors.ink }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Seat list */}
          <div className="mt-3 max-h-48 overflow-y-auto">
            {filteredSeats.length === 0 ? (
              <div className="text-center py-4 text-sm" style={{ color: colors.inkSecondary }}>
                {hasFilters ? 'No seats match filters' : 'No seats owned'}
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead style={{ color: colors.inkSecondary, borderBottom: `1px solid ${colors.rule}` }}>
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
                      className="hover:opacity-80"
                      style={{ borderBottom: `1px solid ${colors.paper3}` }}
                    >
                      <td className="py-1.5 truncate max-w-[100px]" title={seat.name} style={{ color: colors.ink }}>
                        {seat.name}
                      </td>
                      <td className="py-1.5" style={{ color: colors.inkSecondary }}>{seat.state}</td>
                      <td className="py-1.5 text-center">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px]"
                          style={{
                            backgroundColor: ECON_LABELS[seat.ideology.econ].colors.bg,
                            color: ECON_LABELS[seat.ideology.econ].colors.text,
                            border: `1px solid ${ECON_LABELS[seat.ideology.econ].colors.border}`
                          }}
                        >
                          {ECON_LABELS[seat.ideology.econ].label}
                        </span>
                      </td>
                      <td className="py-1.5 text-center">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px]"
                          style={{
                            backgroundColor: SOCIAL_LABELS[seat.ideology.social].colors.bg,
                            color: SOCIAL_LABELS[seat.ideology.social].colors.text,
                            border: `1px solid ${SOCIAL_LABELS[seat.ideology.social].colors.border}`
                          }}
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
          <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${colors.rule}` }}>
            <div className="text-xs mb-1" style={{ color: colors.inkSecondary }}>By State:</div>
            <div className="flex flex-wrap gap-1 text-xs">
              {Object.entries(stateBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([state, count]) => (
                  <span
                    key={state}
                    className="px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: colors.paper2, color: colors.ink, border: `1px solid ${colors.rule}` }}
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
