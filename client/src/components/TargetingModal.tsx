import React from 'react';
import { Player, CampaignCard, PendingCampaign } from '../types';
import { Target, Users } from 'lucide-react';

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
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 animate-scale-in">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Choose Your Target</h2>
          <p className="text-gray-600 mt-2">
            Your campaign "<span className="font-medium">{card.name}</span>" will take{' '}
            <span className="font-bold text-green-600">+{pendingCampaign.calculatedDelta} seats</span>
          </p>
          {pendingCampaign.agendaBonus > 0 && (
            <p className="text-purple-600 text-sm mt-1">
              (includes +{pendingCampaign.agendaBonus} agenda bonus!)
            </p>
          )}
        </div>
        
        <div className="space-y-3">
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Select which opponent loses seats:
          </p>
          
          {opponents.map(opponent => (
            <button
              key={opponent.id}
              onClick={() => onSelectTarget(opponent.id)}
              className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-red-400 hover:bg-red-50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: opponent.color }}
                >
                  {opponent.name.charAt(0)}
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900">{opponent.name}</div>
                  <div className="text-sm text-gray-500">{opponent.playerName}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">{opponent.seats}</div>
                <div className="text-xs text-gray-500">seats</div>
                <div className="text-red-500 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  → {Math.max(0, opponent.seats - pendingCampaign.calculatedDelta)}
                </div>
              </div>
            </button>
          ))}
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">
            Seats will be transferred from your chosen target to your party
          </p>
        </div>
      </div>
    </div>
  );
}
