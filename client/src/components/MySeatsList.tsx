/**
 * MySeatsList Component
 *
 * Displays seat cards owned by the current player with artwork.
 * Shows seat name, state, ideology, and optional artwork.
 */

import React, { useMemo } from 'react';
import { Seat, SeatId, StateCode, EconBucket, SocialBucket } from '../types';
import { MapPin, Building2 } from 'lucide-react';
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

// Ideology bucket display helpers
type IdeologyColorSet = { bg: string; text: string; border: string };

const ECON_LABELS: Record<EconBucket, { label: string; colors: IdeologyColorSet }> = {
  LEFT: { label: 'Left', colors: SEAT_IDEOLOGY_COLORS.LEFT },
  CENTER: { label: 'Ctr', colors: SEAT_IDEOLOGY_COLORS.CENTER },
  RIGHT: { label: 'Right', colors: SEAT_IDEOLOGY_COLORS.RIGHT },
};

const SOCIAL_LABELS: Record<SocialBucket, { label: string; colors: IdeologyColorSet }> = {
  PROG: { label: 'Prog', colors: SEAT_IDEOLOGY_COLORS.PROG },
  CENTER: { label: 'Ctr', colors: SEAT_IDEOLOGY_COLORS.CENTER },
  CONS: { label: 'Cons', colors: SEAT_IDEOLOGY_COLORS.CONS },
};

export function MySeatsList({ seats, playerId, playerColor }: MySeatsListProps) {
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

  return (
    <div className="ballot-paper rounded-lg p-4" style={{ backgroundColor: colors.paper1, border: `2px solid ${colors.rule}` }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3" style={{ borderLeft: `4px solid ${playerColor}`, paddingLeft: '8px' }}>
        <MapPin className="w-4 h-4" style={{ color: playerColor }} />
        <span className="font-semibold" style={{ color: colors.ink }}>My Seats</span>
        <span className="text-sm" style={{ color: colors.inkSecondary }}>({mySeats.length})</span>
      </div>

      {/* Seat cards grid */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {mySeats.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: colors.inkSecondary }}>
            No seats owned
          </div>
        ) : (
          mySeats.map(seat => (
            <div key={seat.id} className="rounded-lg overflow-hidden" style={{ backgroundColor: colors.paper2, border: `2px solid ${colors.rule}` }}>
              {/* Artwork box */}
              <div style={{
                width: '100%',
                height: '80px',
                backgroundColor: colors.paper3,
                borderBottom: `1px solid ${colors.rule}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {seat.artworkUrl ? (
                  <img src={seat.artworkUrl} alt={seat.name} className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-8 h-8" style={{ color: colors.inkSecondary, opacity: 0.3 }} />
                )}
              </div>

              {/* Card content */}
              <div className="p-2">
                <div className="font-semibold text-sm truncate" title={seat.name} style={{ color: colors.ink }}>
                  {seat.name}
                </div>
                <div className="text-xs mt-0.5" style={{ color: colors.inkSecondary }}>
                  {seat.state}
                </div>

                {/* Ideology badges */}
                <div className="flex gap-1 mt-2">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{
                      backgroundColor: ECON_LABELS[seat.ideology.econ].colors.bg,
                      color: ECON_LABELS[seat.ideology.econ].colors.text,
                      border: `1px solid ${ECON_LABELS[seat.ideology.econ].colors.border}`
                    }}
                  >
                    {ECON_LABELS[seat.ideology.econ].label}
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{
                      backgroundColor: SOCIAL_LABELS[seat.ideology.social].colors.bg,
                      color: SOCIAL_LABELS[seat.ideology.social].colors.text,
                      border: `1px solid ${SOCIAL_LABELS[seat.ideology.social].colors.border}`
                    }}
                  >
                    {SOCIAL_LABELS[seat.ideology.social].label}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
