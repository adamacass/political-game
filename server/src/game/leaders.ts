import type { LeaderDefinition, LeaderTrait, Leader } from '../types';

// ============================================================
// TRAIT DEFINITIONS
// ============================================================

const TRAITS: Record<string, LeaderTrait> = {
  // Worker / Union traits
  union_solidarity: {
    id: 'union_solidarity',
    name: 'Union Solidarity',
    description: 'Years on the picket line built deep bonds with working Australians.',
    effects: { campaignBonus: 0.2, loyaltyBonus: 0.15 },
  },
  collective_bargaining: {
    id: 'collective_bargaining',
    name: 'Collective Bargaining',
    description: 'Skilled at negotiation, but business groups view them with suspicion.',
    effects: { capitalBonus: 2, fundraiseBonus: -0.1 },
  },

  // Finance / Corporate traits
  market_acumen: {
    id: 'market_acumen',
    name: 'Market Acumen',
    description: 'Decades in finance means deep pockets and deeper donor networks.',
    effects: { fundraiseBonus: 0.3, campaignBonus: -0.1 },
  },
  fiscal_discipline: {
    id: 'fiscal_discipline',
    name: 'Fiscal Discipline',
    description: 'Runs a tight ship — policy implementation is efficient and cost-effective.',
    effects: { policySpeed: 1, capitalBonus: 1 },
  },

  // Activist traits
  grassroots_fire: {
    id: 'grassroots_fire',
    name: 'Grassroots Fire',
    description: 'Can mobilise thousands with a single social media post.',
    effects: { campaignBonus: 0.25, loyaltyBonus: 0.1 },
  },
  lightning_rod: {
    id: 'lightning_rod',
    name: 'Lightning Rod',
    description: 'Attracts both passionate supporters and fierce detractors.',
    effects: { mediaSavvy: 0.15, approvalBonus: -0.05 },
  },

  // Diplomatic traits
  diplomatic_finesse: {
    id: 'diplomatic_finesse',
    name: 'Diplomatic Finesse',
    description: 'Trained to de-escalate crises and navigate hostile media cycles.',
    effects: { mediaSavvy: 0.3, attackResistance: 0.2 },
  },
  steady_hand: {
    id: 'steady_hand',
    name: 'Steady Hand',
    description: 'Calm under pressure, rarely makes unforced errors.',
    effects: { approvalBonus: 0.05, capitalBonus: 1 },
  },

  // Rural traits
  salt_of_the_earth: {
    id: 'salt_of_the_earth',
    name: 'Salt of the Earth',
    description: 'Authentic rural credibility that city politicians can only dream of.',
    effects: { loyaltyBonus: 0.2, campaignBonus: 0.1 },
  },
  regional_champion: {
    id: 'regional_champion',
    name: 'Regional Champion',
    description: 'Fights relentlessly for the bush — but struggles in metro media.',
    effects: { approvalBonus: 0.05, mediaSavvy: -0.1 },
  },

  // Medical traits
  trusted_healer: {
    id: 'trusted_healer',
    name: 'Trusted Healer',
    description: 'The public trusts a doctor. Approval comes naturally.',
    effects: { approvalBonus: 0.1, attackResistance: 0.15 },
  },
  evidence_based: {
    id: 'evidence_based',
    name: 'Evidence-Based',
    description: 'Policies grounded in data are implemented faster and more effectively.',
    effects: { policySpeed: 1, capitalBonus: 1 },
  },

  // Legal traits
  cross_examiner: {
    id: 'cross_examiner',
    name: 'Cross-Examiner',
    description: 'Devastating in Question Time — no minister is safe from scrutiny.',
    effects: { campaignBonus: 0.15, mediaSavvy: 0.2 },
  },
  legal_mind: {
    id: 'legal_mind',
    name: 'Legal Mind',
    description: 'Constitutional expertise means faster policy drafting.',
    effects: { policySpeed: 2, capitalBonus: 1 },
  },

  // Education traits
  educator: {
    id: 'educator',
    name: 'Educator',
    description: 'Can explain complex policy in plain language — a rare political gift.',
    effects: { campaignBonus: 0.15, loyaltyBonus: 0.1 },
  },
  community_builder: {
    id: 'community_builder',
    name: 'Community Builder',
    description: 'Years in school communities forged strong local networks.',
    effects: { campaignBonus: 0.1, approvalBonus: 0.05 },
  },

  // Engineering traits
  systems_thinker: {
    id: 'systems_thinker',
    name: 'Systems Thinker',
    description: 'Sees the connections between policy levers that others miss.',
    effects: { policySpeed: 2, capitalBonus: 2 },
  },
  infrastructure_vision: {
    id: 'infrastructure_vision',
    name: 'Infrastructure Vision',
    description: 'Big-picture planning earns respect, if not headlines.',
    effects: { approvalBonus: 0.05, fundraiseBonus: 0.1 },
  },

  // Military traits
  command_authority: {
    id: 'command_authority',
    name: 'Command Authority',
    description: 'Military bearing projects strength and decisiveness.',
    effects: { attackResistance: 0.25, approvalBonus: 0.05 },
  },
  national_security: {
    id: 'national_security',
    name: 'National Security',
    description: 'Defence credentials resonate with security-conscious voters.',
    effects: { loyaltyBonus: 0.15, mediaSavvy: 0.1 },
  },

  // Tech / Startup traits
  disruptor: {
    id: 'disruptor',
    name: 'Disruptor',
    description: 'Silicon Valley connections translate into Silicon Beach fundraising.',
    effects: { fundraiseBonus: 0.25, policySpeed: 1 },
  },
  innovation_agenda: {
    id: 'innovation_agenda',
    name: 'Innovation Agenda',
    description: 'Appeals to young professionals and the tech sector.',
    effects: { campaignBonus: 0.1, capitalBonus: 1 },
  },

  // Indigenous traits
  elder_wisdom: {
    id: 'elder_wisdom',
    name: 'Elder Wisdom',
    description: 'Sixty thousand years of custodianship lends unmatched moral authority.',
    effects: { loyaltyBonus: 0.25, approvalBonus: 0.1 },
  },
  reconciliation: {
    id: 'reconciliation',
    name: 'Reconciliation',
    description: 'Bridges divides that others exploit. Communities unite behind them.',
    effects: { campaignBonus: 0.15, attackResistance: 0.15 },
  },

  // Media traits
  media_mastery: {
    id: 'media_mastery',
    name: 'Media Mastery',
    description: 'Knows every editor, every producer, every deadline. Controls the narrative.',
    effects: { mediaSavvy: 0.4, campaignBonus: 0.1 },
  },
  spin_doctor: {
    id: 'spin_doctor',
    name: 'Spin Doctor',
    description: 'Can turn any negative into a positive — until the truth catches up.',
    effects: { attackResistance: 0.2, mediaSavvy: 0.15 },
  },

  // Organiser traits
  ground_game: {
    id: 'ground_game',
    name: 'Ground Game',
    description: 'Built a volunteer army that knocks on every door in every marginal seat.',
    effects: { campaignBonus: 0.3, loyaltyBonus: 0.15 },
  },
  people_power: {
    id: 'people_power',
    name: 'People Power',
    description: 'Small donations from many hands add up to a formidable war chest.',
    effects: { fundraiseBonus: 0.15, campaignBonus: 0.1 },
  },

  // Academic traits
  policy_wonk: {
    id: 'policy_wonk',
    name: 'Policy Wonk',
    description: 'Published more white papers than anyone in parliament. Policies stick.',
    effects: { policySpeed: 2, capitalBonus: 2 },
  },
  ivory_tower: {
    id: 'ivory_tower',
    name: 'Ivory Tower',
    description: 'Brilliant mind, but struggles to connect with ordinary voters.',
    effects: { approvalBonus: 0.05, campaignBonus: -0.1 },
  },

  // Sports traits
  national_hero: {
    id: 'national_hero',
    name: 'National Hero',
    description: 'Everyone remembers that grand final. Name recognition is off the charts.',
    effects: { campaignBonus: 0.2, mediaSavvy: 0.2 },
  },
  team_player: {
    id: 'team_player',
    name: 'Team Player',
    description: 'Locker room leadership translates to party unity and voter trust.',
    effects: { loyaltyBonus: 0.2, approvalBonus: 0.05 },
  },
};

// ============================================================
// LEADER DEFINITIONS
// ============================================================

const LEADER_DEFINITIONS: LeaderDefinition[] = [
  // 1. The Union Boss
  {
    id: 'union_boss',
    name: 'Pat Callahan',
    title: 'The Union Boss',
    portrait: '\u{1F3ED}',
    backstory:
      'Rose through the ACTU ranks during the waterfront disputes, earning a reputation as a tireless advocate for working families. Opponents call them a relic of old Labor, but their base would walk through fire for them.',
    traits: [TRAITS.union_solidarity, TRAITS.collective_bargaining],
    baseApproval: 0.15,
    charisma: 0.6,
    experience: 0.75,
    scandalRisk: 0.3,
  },

  // 2. The Banker
  {
    id: 'banker',
    name: 'Victoria Ashworth',
    title: 'The Banker',
    portrait: '\u{1F3E6}',
    backstory:
      'Former managing director at Macquarie, Victoria traded the corner office for the campaign trail. Her donor rolodex is the envy of every party treasurer, though talkback callers question whether she has ever shopped at Woolies.',
    traits: [TRAITS.market_acumen, TRAITS.fiscal_discipline],
    baseApproval: -0.05,
    charisma: 0.5,
    experience: 0.7,
    scandalRisk: 0.35,
  },

  // 3. The Activist
  {
    id: 'activist',
    name: 'Jade Moreno',
    title: 'The Activist',
    portrait: '\u{270A}',
    backstory:
      'Jade cut their teeth at GetUp!, organising climate rallies that shut down the CBD and trended worldwide. Their energy is infectious but their Twitter history keeps the oppo research team working overtime.',
    traits: [TRAITS.grassroots_fire, TRAITS.lightning_rod],
    baseApproval: 0.1,
    charisma: 0.8,
    experience: 0.3,
    scandalRisk: 0.6,
  },

  // 4. The Diplomat
  {
    id: 'diplomat',
    name: 'Richard Leung',
    title: 'The Diplomat',
    portrait: '\u{1F54A}\uFE0F',
    backstory:
      'A career DFAT officer who negotiated trade deals across three continents, Richard brings a calm authority to the dispatch box. His measured tone can make even bad news sound like progress.',
    traits: [TRAITS.diplomatic_finesse, TRAITS.steady_hand],
    baseApproval: 0.1,
    charisma: 0.55,
    experience: 0.85,
    scandalRisk: 0.15,
  },

  // 5. The Farmer
  {
    id: 'farmer',
    name: 'Brenda McAllister',
    title: 'The Farmer',
    portrait: '\u{1F33E}',
    backstory:
      'Fifth-generation wheat farmer from the Mallee, Brenda survived the millennium drought and the mouse plagues that followed. Canberra press gallery types underestimate her at their peril — the regions never do.',
    traits: [TRAITS.salt_of_the_earth, TRAITS.regional_champion],
    baseApproval: 0.2,
    charisma: 0.35,
    experience: 0.6,
    scandalRisk: 0.15,
  },

  // 6. The Doctor
  {
    id: 'doctor',
    name: 'Amir Hassan',
    title: 'The Doctor',
    portrait: '\u{1FA7A}',
    backstory:
      'An emergency physician who became a household name during the pandemic press conferences. Voters trust Amir because he has held their hands through the worst nights of their lives.',
    traits: [TRAITS.trusted_healer, TRAITS.evidence_based],
    baseApproval: 0.25,
    charisma: 0.55,
    experience: 0.5,
    scandalRisk: 0.1,
  },

  // 7. The Lawyer
  {
    id: 'lawyer',
    name: 'Catherine Blackwood',
    title: 'The Lawyer',
    portrait: '\u{2696}\uFE0F',
    backstory:
      'Catherine made her name prosecuting corporate fraud at ASIC before entering parliament. Her razor-sharp questioning in Senate Estimates has ended more than one ministerial career.',
    traits: [TRAITS.cross_examiner, TRAITS.legal_mind],
    baseApproval: 0.0,
    charisma: 0.65,
    experience: 0.65,
    scandalRisk: 0.45,
  },

  // 8. The Teacher
  {
    id: 'teacher',
    name: 'Danny Kowalski',
    title: 'The Teacher',
    portrait: '\u{1F4DA}',
    backstory:
      'Spent twenty years in Western Sydney public schools before the local branch convinced him to run. Danny can explain superannuation policy to a year-ten class — and make them care.',
    traits: [TRAITS.educator, TRAITS.community_builder],
    baseApproval: 0.1,
    charisma: 0.5,
    experience: 0.45,
    scandalRisk: 0.1,
  },

  // 9. The Engineer
  {
    id: 'engineer',
    name: 'Priya Venkatesh',
    title: 'The Engineer',
    portrait: '\u{1F527}',
    backstory:
      'Led the engineering team on the Inland Rail project before deciding the real bottlenecks were in Canberra, not in the Toowoomba range. Priya thinks in systems and speaks in solutions.',
    traits: [TRAITS.systems_thinker, TRAITS.infrastructure_vision],
    baseApproval: 0.05,
    charisma: 0.4,
    experience: 0.6,
    scandalRisk: 0.15,
  },

  // 10. The General
  {
    id: 'general',
    name: 'James "Bluey" Thornton',
    title: 'The General',
    portrait: '\u{1F396}\uFE0F',
    backstory:
      'Retired Major General who commanded Australian forces in three theatres. Bluey is the candidate RSL clubs and suburban dads put on a pedestal, and he wears the gravitas like a second uniform.',
    traits: [TRAITS.command_authority, TRAITS.national_security],
    baseApproval: 0.15,
    charisma: 0.55,
    experience: 0.8,
    scandalRisk: 0.2,
  },

  // 11. The Entrepreneur
  {
    id: 'entrepreneur',
    name: 'Zara Okonkwo',
    title: 'The Entrepreneur',
    portrait: '\u{1F680}',
    backstory:
      'Built a fintech unicorn from a garage in Surry Hills before turning thirty. Zara brings startup energy to a parliament that still faxes amendments, and her cap table doubles as a donor list.',
    traits: [TRAITS.disruptor, TRAITS.innovation_agenda],
    baseApproval: 0.0,
    charisma: 0.7,
    experience: 0.25,
    scandalRisk: 0.35,
  },

  // 12. The Indigenous Elder
  {
    id: 'indigenous_elder',
    name: 'Uncle Ray Jupurrurla',
    title: 'The Indigenous Elder',
    portrait: '\u{1F30F}',
    backstory:
      'A Warlpiri elder and land rights campaigner who has spent decades building bridges between communities. When Uncle Ray speaks, even the most cynical backbencher falls silent.',
    traits: [TRAITS.elder_wisdom, TRAITS.reconciliation],
    baseApproval: 0.2,
    charisma: 0.6,
    experience: 0.7,
    scandalRisk: 0.05,
  },

  // 13. The Media Mogul
  {
    id: 'media_mogul',
    name: 'Sophie Delacroix',
    title: 'The Media Mogul',
    portrait: '\u{1F4F0}',
    backstory:
      'Former executive producer at Nine who knows exactly how the sausage factory of public opinion works. Sophie controls the news cycle like a conductor controls an orchestra — but her own closet has more skeletons than a Halloween store.',
    traits: [TRAITS.media_mastery, TRAITS.spin_doctor],
    baseApproval: -0.05,
    charisma: 0.7,
    experience: 0.55,
    scandalRisk: 0.6,
  },

  // 14. The Grassroots Organiser
  {
    id: 'grassroots_organiser',
    name: 'Mika Nguyen',
    title: 'The Grassroots Organiser',
    portrait: '\u{1F331}',
    backstory:
      'Mika built a volunteer network of ten thousand from a folding table at Footscray Market. They have never held office but have helped elect half the progressive caucus across three states.',
    traits: [TRAITS.ground_game, TRAITS.people_power],
    baseApproval: 0.05,
    charisma: 0.6,
    experience: 0.2,
    scandalRisk: 0.2,
  },

  // 15. The Academic
  {
    id: 'academic',
    name: 'Professor Eleanor Whitfield',
    title: 'The Academic',
    portrait: '\u{1F393}',
    backstory:
      'Chair of Public Policy at ANU, Eleanor has advised four governments and authored the textbook every polsci student dreads. Her policy papers are impeccable — her small talk, less so.',
    traits: [TRAITS.policy_wonk, TRAITS.ivory_tower],
    baseApproval: 0.05,
    charisma: 0.3,
    experience: 0.8,
    scandalRisk: 0.1,
  },

  // 16. The Sports Star
  {
    id: 'sports_star',
    name: 'Lachlan "Lachy" O\'Brien',
    title: 'The Sports Star',
    portrait: '\u{1F3C6}',
    backstory:
      'Three-time Coleman Medallist who retired from the AFL as a living legend. Lachy has never read Hansard but could win a seat just by walking through a shopping centre and shaking hands.',
    traits: [TRAITS.national_hero, TRAITS.team_player],
    baseApproval: 0.3,
    charisma: 0.9,
    experience: 0.15,
    scandalRisk: 0.35,
  },
];

// ============================================================
// EXPORTS
// ============================================================

/** Returns all 16 leader definitions. */
export function getAllLeaders(): LeaderDefinition[] {
  return [...LEADER_DEFINITIONS];
}

/** Creates a runtime Leader instance from a static LeaderDefinition. */
export function createLeaderFromDefinition(def: LeaderDefinition): Leader {
  return {
    definitionId: def.id,
    name: def.name,
    title: def.title,
    portrait: def.portrait,
    traits: def.traits.map((t) => ({ ...t, effects: { ...t.effects } })),
    personalApproval: def.baseApproval,
    charisma: def.charisma,
    experience: def.experience,
    scandalRisk: def.scandalRisk,
    isPM: false,
    roundsAsPM: 0,
    defected: false,
  };
}

export { LEADER_DEFINITIONS, TRAITS };
