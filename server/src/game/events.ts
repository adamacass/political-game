import { PoliticalEvent, EventEffect } from '../types';

/**
 * All political event definitions for The House.
 *
 * Events inject chaos and drama into the game, modelling the unpredictable
 * nature of Australian politics. Each event has newspaper-style headlines,
 * a description of what happened, and mechanical effects.
 *
 * Effect targets:
 *   leader   - the player with the most seats
 *   trailer  - the player with the fewest seats
 *   all      - every player
 *   random   - one randomly chosen player
 *   proposer - whoever proposed the most recent bill
 *
 * Effect types:
 *   approval - shifts public approval rating
 *   funds    - adds or removes campaign funds
 *   seats    - directly changes seat count
 */

const EVENTS: PoliticalEvent[] = [
  // ============================================================
  // ECONOMIC
  // ============================================================
  {
    id: 'evt_rba_rate_hike',
    name: 'Reserve Bank Rate Hike',
    headline: 'RBA HIKES RATES AGAIN: MORTGAGE PAIN DEEPENS',
    description:
      'The Reserve Bank has raised the cash rate by another 25 basis points, piling pressure on mortgage holders. Voters blame the government for inaction on the cost of living.',
    category: 'economic',
    effects: [
      { target: 'leader', type: 'approval', amount: -8 },
      { target: 'leader', type: 'seats', amount: -1 },
    ],
  },
  {
    id: 'evt_unemployment_falls',
    name: 'Unemployment Falls',
    headline: 'JOBS BOOM: UNEMPLOYMENT HITS 50-YEAR LOW',
    description:
      'The Australian Bureau of Statistics reports unemployment has fallen to 3.4%, the lowest since 1974. The government claims credit for the strong labour market.',
    category: 'economic',
    effects: [
      { target: 'leader', type: 'approval', amount: 6 },
      { target: 'leader', type: 'seats', amount: 1 },
    ],
  },
  {
    id: 'evt_recession_fears',
    name: 'Recession Warning',
    headline: 'TREASURY WARNS: RECESSION RISK RISES TO 40%',
    description:
      'Leaked Treasury modelling shows the probability of a technical recession has risen sharply. Consumer confidence plummets and business investment stalls.',
    category: 'economic',
    effects: [
      { target: 'all', type: 'approval', amount: -4 },
      { target: 'leader', type: 'funds', amount: -5 },
    ],
  },
  {
    id: 'evt_mining_boom',
    name: 'Mining Boom Returns',
    headline: 'IRON ORE SURGES PAST $150: BUDGET WINDFALL',
    description:
      'Surging commodity prices deliver a massive revenue windfall to the federal budget. The Treasurer announces improved fiscal forecasts and new spending plans.',
    category: 'economic',
    effects: [
      { target: 'all', type: 'funds', amount: 5 },
      { target: 'leader', type: 'approval', amount: 3 },
    ],
  },
  {
    id: 'evt_housing_crisis',
    name: 'Housing Crisis Deepens',
    headline: 'HOUSING EMERGENCY: RENTS UP 15%, VACANCIES AT ZERO',
    description:
      'Rental vacancy rates have hit record lows in every capital city. Homelessness services report being overwhelmed as families are priced out of the market.',
    category: 'economic',
    effects: [
      { target: 'leader', type: 'approval', amount: -7 },
      { target: 'trailer', type: 'approval', amount: 4 },
      { target: 'trailer', type: 'seats', amount: 1 },
    ],
  },

  // ============================================================
  // SCANDAL
  // ============================================================
  {
    id: 'evt_expenses_scandal',
    name: 'Ministerial Expenses Scandal',
    headline: 'CHOPPERGATE II: MINISTER BILLED TAXPAYERS FOR LUXURY TRIPS',
    description:
      'A senior minister is caught claiming tens of thousands in dubious travel expenses, including helicopter rides and five-star hotel stays for personal holidays.',
    category: 'scandal',
    effects: [
      { target: 'leader', type: 'approval', amount: -10 },
      { target: 'leader', type: 'seats', amount: -2 },
    ],
  },
  {
    id: 'evt_branch_stacking',
    name: 'Branch Stacking Exposed',
    headline: 'BRANCH STACKING BOMBSHELL ROCKS PARTY',
    description:
      'An explosive media investigation reveals systematic branch stacking and factional manipulation of preselection processes within a major party.',
    category: 'scandal',
    effects: [
      { target: 'random', type: 'approval', amount: -8 },
      { target: 'random', type: 'seats', amount: -1 },
    ],
  },
  {
    id: 'evt_lobby_scandal',
    name: 'Lobbying Scandal',
    headline: 'CASH FOR ACCESS: SECRET LOBBYIST MEETINGS REVEALED',
    description:
      'Hidden camera footage shows a party official offering private ministerial meetings in exchange for donations. The footage goes viral on social media.',
    category: 'scandal',
    effects: [
      { target: 'leader', type: 'approval', amount: -6 },
      { target: 'leader', type: 'funds', amount: -8 },
      { target: 'trailer', type: 'approval', amount: 3 },
    ],
  },
  {
    id: 'evt_promise_broken',
    name: 'Election Promise Broken',
    headline: 'BROKEN PROMISE: GOVERNMENT DUMPS KEY ELECTION PLEDGE',
    description:
      'The government quietly abandons a signature election commitment, claiming changed economic circumstances. The opposition calls it a betrayal of voters.',
    category: 'scandal',
    effects: [
      { target: 'leader', type: 'approval', amount: -9 },
      { target: 'trailer', type: 'seats', amount: 1 },
    ],
  },
  {
    id: 'evt_staffers_scandal',
    name: 'Parliament House Scandal',
    headline: 'CULTURE OF ABUSE: DAMNING REPORT ON PARLIAMENT HOUSE',
    description:
      'An independent review into workplace culture at Parliament House reveals systemic bullying and harassment. All parties face public fury over inaction.',
    category: 'scandal',
    effects: [
      { target: 'all', type: 'approval', amount: -5 },
    ],
  },

  // ============================================================
  // INTERNATIONAL
  // ============================================================
  {
    id: 'evt_china_trade',
    name: 'China Trade Dispute',
    headline: 'BEIJING SLAPS TARIFFS ON AUSTRALIAN EXPORTS',
    description:
      'China imposes new tariffs on Australian wine, barley, and lobster exports in an escalation of diplomatic tensions. Regional exporters demand government intervention.',
    category: 'international',
    effects: [
      { target: 'leader', type: 'approval', amount: -4 },
      { target: 'all', type: 'funds', amount: -3 },
    ],
  },
  {
    id: 'evt_pacific_diplomacy',
    name: 'Pacific Diplomacy Win',
    headline: 'AUSTRALIA SECURES LANDMARK PACIFIC ISLANDS AGREEMENT',
    description:
      'A new regional security and climate cooperation pact with Pacific Island nations is hailed as a diplomatic triumph, boosting Australia\'s standing in the region.',
    category: 'international',
    effects: [
      { target: 'leader', type: 'approval', amount: 5 },
      { target: 'leader', type: 'seats', amount: 1 },
    ],
  },
  {
    id: 'evt_us_alliance',
    name: 'US Alliance Tensions',
    headline: 'WHITE HOUSE SNUB: PM LEFT WAITING ON TRADE DEAL',
    description:
      'The US President declines to meet the Prime Minister at a scheduled bilateral, citing scheduling conflicts. Commentators call it a humiliating diplomatic slight.',
    category: 'international',
    effects: [
      { target: 'leader', type: 'approval', amount: -5 },
      { target: 'trailer', type: 'approval', amount: 2 },
    ],
  },
  {
    id: 'evt_refugee_boat',
    name: 'Asylum Seeker Crisis',
    headline: 'BOAT ARRIVALS SURGE: BORDER POLICY UNDER SCRUTINY',
    description:
      'A sharp increase in maritime asylum seeker arrivals forces the issue back onto the front pages, reigniting fierce debate over border protection policy.',
    category: 'international',
    effects: [
      { target: 'leader', type: 'approval', amount: -3 },
      { target: 'random', type: 'seats', amount: -1 },
    ],
  },

  // ============================================================
  // MEDIA
  // ============================================================
  {
    id: 'evt_polling_bombshell',
    name: 'Polling Bombshell',
    headline: 'SHOCK POLL: OPPOSITION SURGES TO 10-POINT LEAD',
    description:
      'A major national poll shows a dramatic swing against the government. The result sparks panic in government ranks and energises the opposition campaign.',
    category: 'media',
    effects: [
      { target: 'leader', type: 'approval', amount: -6 },
      { target: 'leader', type: 'seats', amount: -1 },
      { target: 'trailer', type: 'approval', amount: 4 },
      { target: 'trailer', type: 'seats', amount: 1 },
    ],
  },
  {
    id: 'evt_leadership_spill',
    name: 'Leadership Challenge Rumours',
    headline: 'LEADERSHIP CRISIS: BACKBENCH REVOLT THREATENS PM',
    description:
      'Senior backbenchers are openly canvassing support for a leadership challenge. The PM calls an emergency party room meeting to shore up support.',
    category: 'media',
    effects: [
      { target: 'leader', type: 'approval', amount: -8 },
      { target: 'leader', type: 'seats', amount: -2 },
    ],
  },
  {
    id: 'evt_gaffe',
    name: 'Political Gaffe Goes Viral',
    headline: 'HOT MIC DISASTER: LEADER CAUGHT IN EMBARRASSING GAFFE',
    description:
      'A hot microphone captures a party leader making an embarrassing remark about their own voters. The clip is shared millions of times within hours.',
    category: 'media',
    effects: [
      { target: 'random', type: 'approval', amount: -7 },
      { target: 'random', type: 'seats', amount: -1 },
    ],
  },
  {
    id: 'evt_investigative_journalism',
    name: 'Award-Winning Investigation',
    headline: 'EXCLUSIVE: FOUR CORNERS EXPOSES GOVERNMENT WASTE',
    description:
      'An ABC Four Corners investigation reveals billions in wasteful government spending on consulting firms. Public outrage forces a senate inquiry.',
    category: 'media',
    effects: [
      { target: 'leader', type: 'approval', amount: -6 },
      { target: 'leader', type: 'funds', amount: -5 },
      { target: 'trailer', type: 'approval', amount: 3 },
    ],
  },
  {
    id: 'evt_positive_profile',
    name: 'Leader Charm Offensive',
    headline: 'POLL BOOST: PM\'S KITCHEN TABLE INTERVIEW WINS HEARTS',
    description:
      'A widely viewed prime-time interview humanises the PM, who opens up about family life and personal challenges. Approval ratings spike overnight.',
    category: 'media',
    effects: [
      { target: 'leader', type: 'approval', amount: 7 },
      { target: 'leader', type: 'seats', amount: 1 },
    ],
  },

  // ============================================================
  // SOCIAL
  // ============================================================
  {
    id: 'evt_protest_movement',
    name: 'Mass Protest Movement',
    headline: 'HUNDREDS OF THOUSANDS MARCH ON PARLIAMENT',
    description:
      'Massive rallies in every capital city demand action on climate change and cost of living. The movement puts intense pressure on all parties to respond.',
    category: 'social',
    effects: [
      { target: 'all', type: 'approval', amount: -3 },
      { target: 'trailer', type: 'approval', amount: 5 },
    ],
  },
  {
    id: 'evt_backbench_revolt',
    name: 'Backbench Revolt',
    headline: 'PARTY SPLIT: REBELS CROSS THE FLOOR ON KEY VOTE',
    description:
      'A group of government backbenchers crosses the floor to vote against their own party, delivering a humiliating defeat on a crucial piece of legislation.',
    category: 'social',
    effects: [
      { target: 'leader', type: 'seats', amount: -1 },
      { target: 'leader', type: 'approval', amount: -5 },
      { target: 'random', type: 'seats', amount: 1 },
    ],
  },
  {
    id: 'evt_volunteer_surge',
    name: 'Volunteer Surge',
    headline: 'GRASSROOTS ENERGY: RECORD VOLUNTEER SIGN-UPS',
    description:
      'A wave of new volunteers floods campaign offices for the underdog party, energising local campaigns and boosting doorknocking operations across marginal seats.',
    category: 'social',
    effects: [
      { target: 'trailer', type: 'funds', amount: 5 },
      { target: 'trailer', type: 'seats', amount: 1 },
    ],
  },
  {
    id: 'evt_union_action',
    name: 'Nationwide Strike Action',
    headline: 'WORKERS WALK OUT: STRIKE WAVE HITS MAJOR SECTORS',
    description:
      'Unions launch coordinated industrial action across transport, construction, and healthcare, demanding higher wages and better conditions.',
    category: 'social',
    effects: [
      { target: 'leader', type: 'approval', amount: -4 },
      { target: 'all', type: 'funds', amount: -2 },
    ],
  },

  // ============================================================
  // DISASTER
  // ============================================================
  {
    id: 'evt_bushfire',
    name: 'Bushfire Emergency',
    headline: 'CATASTROPHE: BLACK SUMMER FIRES BURN OUT OF CONTROL',
    description:
      'Devastating bushfires rip through multiple states, destroying homes and claiming lives. The national disaster response is put under intense scrutiny.',
    category: 'disaster',
    effects: [
      { target: 'leader', type: 'approval', amount: -6, condition: 'poor_response' },
      { target: 'all', type: 'funds', amount: -4 },
      { target: 'trailer', type: 'approval', amount: 3 },
    ],
  },
  {
    id: 'evt_flood',
    name: 'East Coast Flooding',
    headline: 'FLOOD CRISIS: TOWNS SUBMERGED AS RIVERS BREACH BANKS',
    description:
      'Record rainfall causes catastrophic flooding across NSW and Queensland. Thousands are evacuated as entire communities are cut off by rising waters.',
    category: 'disaster',
    effects: [
      { target: 'all', type: 'funds', amount: -5 },
      { target: 'leader', type: 'approval', amount: -3 },
    ],
  },
  {
    id: 'evt_pandemic_wave',
    name: 'New Pandemic Wave',
    headline: 'NEW VARIANT ALARM: HOSPITALISATIONS SURGE NATIONALLY',
    description:
      'A new virus variant triggers a wave of hospitalisations, straining the health system. Debate erupts over whether to reimpose restrictions.',
    category: 'disaster',
    effects: [
      { target: 'all', type: 'approval', amount: -3 },
      { target: 'leader', type: 'seats', amount: -1 },
      { target: 'leader', type: 'funds', amount: -5 },
    ],
  },
  {
    id: 'evt_cyclone',
    name: 'Tropical Cyclone Devastation',
    headline: 'CYCLONE FURY: CATEGORY 5 STORM FLATTENS FAR NORTH QLD',
    description:
      'A massive tropical cyclone causes widespread destruction across Far North Queensland, wiping out infrastructure and displacing thousands of residents.',
    category: 'disaster',
    effects: [
      { target: 'all', type: 'funds', amount: -3 },
      { target: 'leader', type: 'approval', amount: -2 },
    ],
  },
  {
    id: 'evt_drought',
    name: 'Severe Drought Declaration',
    headline: 'DUST AND DESPAIR: WORST DROUGHT IN A GENERATION',
    description:
      'Drought conditions across the eastern states push farming communities to breaking point. Calls mount for emergency relief and a long-term water security plan.',
    category: 'disaster',
    effects: [
      { target: 'leader', type: 'approval', amount: -4 },
      { target: 'all', type: 'funds', amount: -2 },
      { target: 'trailer', type: 'approval', amount: 2 },
    ],
  },
];

/**
 * Return a copy of all political event definitions.
 */
export function getAllEvents(): PoliticalEvent[] {
  return EVENTS.map(event => ({
    ...event,
    effects: event.effects.map(e => ({ ...e })),
  }));
}
