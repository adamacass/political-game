import React from 'react';
import { Player, CampaignCard, PendingCampaign } from '../types';
import { Target, Users } from 'lucide-react';

// Design tokens - ballot paper aesthetic
const colors = {
  paper1: '#F4F1E8',
  paper2: '#EEEBE2',
  paper3: '#E8E5DC',
  ink: '#111111',
  inkSecondary: '#3A3A3A',
  rule: '#1A1A1A',
  success: '#16a34a',
  error: '#dc2626',
};

interface TargetingModalProps {
  pendingCampaign: PendingCampaign;
  players: Player[];
  currentPlayerId: string;
  onSelectTarget: (targetId: string) => void;
}

export function TargetingModal({ pendingCampaign, players, currentPlayerId, onSelectTarget }: TargetingModalProps) {
  const opponents = players.filter(p => p.id !== currentPlayerId && p.seats > 0);
  const card = pendingCampaign.card;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="rounded-lg p-6 max-w-md w-full mx-4 animate-scale-in" style={{ backgroundColor: colors.paper1, border: `2px solid ${colors.rule}` }}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: colors.paper2, border: `2px solid ${colors.rule}` }}>
            <Target className="w-8 h-8" style={{ color: colors.ink }} />
          </div>
          <h2 className="text-2xl font-bold" style={{ color: colors.ink }}>Choose Your Target</h2>
          <p className="mt-2" style={{ color: colors.inkSecondary }}>
            Your campaign "<span className="font-medium" style={{ color: colors.ink }}>{card.name}</span>" will take{' '}
            <span className="font-bold" style={{ color: colors.success }}>+{pendingCampaign.calculatedDelta} seats</span>
          </p>
          {pendingCampaign.agendaBonus > 0 && (
            <p className="text-sm mt-1" style={{ color: colors.ink }}>
              (includes +{pendingCampaign.agendaBonus} agenda bonus!)
            </p>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm flex items-center gap-2" style={{ color: colors.inkSecondary }}>
            <Users className="w-4 h-4" />
            Select which opponent loses seats:
          </p>

          {opponents.map(opponent => (
            <button
              key={opponent.id}
              onClick={() => onSelectTarget(opponent.id)}
              className="w-full p-4 rounded-lg transition-all flex items-center justify-between group hover:opacity-90"
              style={{ backgroundColor: colors.paper2, border: `2px solid ${colors.rule}` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: opponent.color, border: `2px solid ${colors.rule}` }}
                >
                  {opponent.name.charAt(0)}
                </div>
                <div className="text-left">
                  <div className="font-medium" style={{ color: colors.ink }}>{opponent.name}</div>
                  <div className="text-sm" style={{ color: colors.inkSecondary }}>{opponent.playerName}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold" style={{ color: colors.ink }}>{opponent.seats}</div>
                <div className="text-xs" style={{ color: colors.inkSecondary }}>seats</div>
                <div className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: colors.error }}>
                  → {Math.max(0, opponent.seats - pendingCampaign.calculatedDelta)}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${colors.rule}` }}>
          <p className="text-xs text-center" style={{ color: colors.inkSecondary }}>
            Seats will be transferred from your chosen target to your party
          </p>
        </div>
      </div>
    </div>
  );
}
