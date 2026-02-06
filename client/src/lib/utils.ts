import type { Issue, Phase, Player, GameState } from '../types';

export const ISSUE_LABELS: Record<Issue, string> = {
  economy: 'Economy',
  health: 'Health',
  housing: 'Housing',
  climate: 'Climate',
  security: 'Security',
  education: 'Education',
};

export const ISSUE_ICONS: Record<Issue, string> = {
  economy: '$',
  health: '+',
  housing: 'H',
  climate: '~',
  security: 'S',
  education: 'E',
};

export const PHASE_LABELS: Record<Phase, string> = {
  waiting: 'Waiting for Players',
  budget: 'Budget Phase',
  action: 'Action Phase',
  legislation_propose: 'Legislation - Proposal',
  legislation_vote: 'Legislation - Vote',
  legislation_result: 'Legislation - Result',
  event: 'Political Event',
  game_over: 'Game Over',
};

export const PHASE_DESCRIPTIONS: Record<Phase, string> = {
  waiting: 'Waiting for players to join...',
  budget: 'Funds are being distributed based on seat holdings',
  action: 'Spend action points to campaign, fundraise, or attack',
  legislation_propose: 'The Speaker may propose a bill',
  legislation_vote: 'Vote on the proposed bill',
  legislation_result: 'Resolving legislation effects',
  event: 'A political event is unfolding',
  game_over: 'The election is over!',
};

export function getPlayerById(state: GameState, playerId: string): Player | undefined {
  return state.players.find(p => p.id === playerId);
}

export function getCurrentPlayer(state: GameState): Player | undefined {
  const currentId = state.turnOrder[state.currentPlayerIndex];
  return getPlayerById(state, currentId);
}

export function getSpeaker(state: GameState): Player | undefined {
  const speakerId = state.turnOrder[state.speakerIndex];
  return getPlayerById(state, speakerId);
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
