import type { Phase, Player, GameState } from '../types';

export const PHASE_LABELS: Record<Phase, string> = {
  waiting: 'Waiting for Players',
  planning: 'Planning Phase',
  resolution: 'Resolution Phase',
  election: 'Election',
  game_over: 'Game Over',
};

export const PHASE_DESCRIPTIONS: Record<Phase, string> = {
  waiting: 'Waiting for players to join...',
  planning: 'Choose your actions for this round',
  resolution: 'Resolving all player actions',
  election: 'Seats are being contested',
  game_over: 'The election is over!',
};

export function getPlayerById(state: GameState, playerId: string): Player | undefined {
  return state.players.find(p => p.id === playerId);
}

export function getSeatLeader(state: GameState): Player | undefined {
  if (state.players.length === 0) return undefined;
  return state.players.reduce((leader, player) =>
    player.seats > leader.seats ? player : leader
  );
}

export function formatIdeology(social: string, economic: string): string {
  const socialLabel = social === 'progressive' ? 'Progressive' : 'Conservative';
  const economicLabel = economic === 'market' ? 'Market' : 'Interventionist';
  return `${socialLabel} / ${economicLabel}`;
}

export function getStanceEmoji(stance: string): string {
  switch (stance) {
    case 'favoured': return '+';
    case 'neutral': return '~';
    case 'opposed': return '-';
    default: return '?';
  }
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
