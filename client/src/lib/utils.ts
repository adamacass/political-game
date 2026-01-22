import type { Issue, Phase, CampaignCard, PolicyCard, Player, GameState } from '../types';

export const ISSUE_LABELS: Record<Issue, string> = {
  economy: 'Economy',
  cost_of_living: 'Cost of Living',
  housing: 'Housing',
  climate: 'Climate',
  security: 'Security',
};

export const ISSUE_ICONS: Record<Issue, string> = {
  economy: '💰',
  cost_of_living: '🛒',
  housing: '🏠',
  climate: '🌍',
  security: '🛡️',
};

export const PHASE_LABELS: Record<Phase, string> = {
  waiting: 'Waiting for Players',
  draw: 'Draw Phase',
  campaign: 'Campaign Phase',
  policy_proposal: 'Policy Proposal',
  policy_vote: 'Policy Vote',
  policy_resolution: 'Resolving Policy',
  wildcard_resolution: 'Wildcard Event',
  game_over: 'Game Over',
  negotiation: 'Negotiation',
  campaign_targeting: 'Select Target',
  agenda_selection: 'Select Agenda',
};

export const PHASE_DESCRIPTIONS: Record<Phase, string> = {
  waiting: 'Waiting for players to join...',
  draw: 'Each player draws one card',
  campaign: 'Play campaign cards to win seats',
  policy_proposal: 'Speaker may propose a policy',
  policy_vote: 'Vote on the proposed policy',
  policy_resolution: 'Resolving policy effects',
  wildcard_resolution: 'A wildcard event is occurring',
  game_over: 'The election is over!',
  negotiation: 'Negotiation',
  campaign_targeting: 'Select Target',
  agenda_selection: 'Select Agenda',
};

export function isCampaignCard(card: CampaignCard | PolicyCard): card is CampaignCard {
  return 'seatDelta' in card;
}

export function isPolicyCard(card: CampaignCard | PolicyCard): card is PolicyCard {
  return 'stanceTable' in card;
}

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

export function getTotalScore(player: Player): number {
  return player.pCapCards.reduce((sum, card) => sum + card.value, 0);
}

export function formatIdeology(social: string, economic: string): string {
  const socialLabel = social === 'progressive' ? 'Progressive' : 'Conservative';
  const economicLabel = economic === 'market' ? 'Market' : 'Interventionist';
  return `${socialLabel} / ${economicLabel}`;
}

export function getStanceEmoji(stance: string): string {
  switch (stance) {
    case 'favoured': return '✅';
    case 'neutral': return '➖';
    case 'opposed': return '❌';
    default: return '❓';
  }
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
