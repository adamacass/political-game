import type { Phase, Player, GameState } from '../types';

export const PHASE_LABELS: Record<Phase, string> = {
  waiting: 'Waiting for Players',
  government_action: 'Government Action',
  opposition_action: 'Opposition Action',
  simulation: 'Simulation',
  dilemma: 'Dilemma',
  media_cycle: 'Media Cycle',
  election: 'Election',
  election_results: 'Election Results',
  round_summary: 'Round Summary',
  game_over: 'Game Over',
};

export const PHASE_DESCRIPTIONS: Record<Phase, string> = {
  waiting: 'Waiting for players to join...',
  government_action: 'The government is adjusting policy sliders',
  opposition_action: 'Opposition parties are choosing their actions',
  simulation: 'Effects propagating through the policy web...',
  dilemma: 'The government faces a tough choice',
  media_cycle: 'The news spotlight shifts...',
  election: 'Seats are being contested!',
  election_results: 'Election results are in',
  round_summary: 'Here\'s what happened this round',
  game_over: 'The game is over!',
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

export function getGovernmentPlayer(state: GameState): Player | undefined {
  return state.players.find(p => p.isGovernment);
}

export function formatIdeology(social: string, economic: string): string {
  const socialLabel = social === 'progressive' ? 'Progressive' : 'Conservative';
  const economicLabel = economic === 'market' ? 'Market' : 'Interventionist';
  return `${socialLabel} / ${economicLabel}`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export function formatApproval(value: number): string {
  const percent = ((value + 1) / 2 * 100).toFixed(0);
  return `${percent}%`;
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
