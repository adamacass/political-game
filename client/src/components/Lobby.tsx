import React, { useState, useEffect } from 'react';
import {
  GameState,
  PARTY_COLORS,
  PartyColorId,
  SocialIdeology,
  EconomicIdeology,
  LeaderTrait,
  AIDifficulty,
} from '../types';

// ============================================================
// LEADER DATA (embedded for client use)
// ============================================================

interface LeaderTraitLocal {
  id: string;
  name: string;
  icon: string;
  description: string;
  effects: LeaderTrait['effects'];
}

interface LeaderData {
  id: string;
  name: string;
  title: string;
  portrait: string;
  backstory: string;
  traits: LeaderTraitLocal[];
  baseApproval: number;
  charisma: number;
  experience: number;
  scandalRisk: number;
}

const LEADER_POOL: LeaderData[] = [
  {
    id: 'union_boss',
    name: 'Jack Hartley',
    title: 'The Union Boss',
    portrait: '\u{1F477}',
    backstory: 'Forged in the furnace of the shop floor, Jack rose through the ACTU ranks to become the most feared negotiator in the country. He speaks for the worker and never forgets where he came from.',
    traits: [
      { id: 'working_class_hero', name: 'Working Class Hero', icon: '\u{1F528}', description: 'Deep connections to blue-collar voters boost campaign reach.', effects: { campaignBonus: 0.15 } },
      { id: 'solidarity', name: 'Solidarity', icon: '\u270A', description: 'Union networks create unshakeable voter loyalty.', effects: { loyaltyBonus: 0.12 } },
    ],
    baseApproval: 0.1,
    charisma: 0.7,
    experience: 0.6,
    scandalRisk: 0.4,
  },
  {
    id: 'banker',
    name: 'Victoria Chen',
    title: 'The Banker',
    portrait: '\u{1F3E6}',
    backstory: 'Former CEO of the Reserve Bank, Victoria brings razor-sharp fiscal discipline and an unmatched network in the financial sector. She believes sound economics is the foundation of good policy.',
    traits: [
      { id: 'fiscal_hawk', name: 'Fiscal Hawk', icon: '\u{1F4B0}', description: 'Financial expertise translates to superior fundraising.', effects: { fundraiseBonus: 0.2 } },
      { id: 'market_sense', name: 'Market Sense', icon: '\u{1F4C8}', description: 'Economic fluency speeds up policy implementation.', effects: { policySpeed: 0.1 } },
    ],
    baseApproval: 0.0,
    charisma: 0.5,
    experience: 0.85,
    scandalRisk: 0.3,
  },
  {
    id: 'activist',
    name: 'Maya Reddick',
    title: 'The Activist',
    portrait: '\u270A',
    backstory: 'From climate marches to parliament steps, Maya turned grassroots energy into political power. She is unafraid of controversy and thrives when the cameras are rolling.',
    traits: [
      { id: 'grassroots_power', name: 'Grassroots Power', icon: '\u{1F331}', description: 'Movement-building skills give a significant campaign edge.', effects: { campaignBonus: 0.2 } },
      { id: 'media_darling', name: 'Media Darling', icon: '\u2B50', description: 'Natural media presence softens negative coverage.', effects: { mediaSavvy: 0.2 } },
    ],
    baseApproval: 0.15,
    charisma: 0.8,
    experience: 0.3,
    scandalRisk: 0.5,
  },
  {
    id: 'diplomat',
    name: 'Arthur Pemberton',
    title: 'The Diplomat',
    portrait: '\u{1F91D}',
    backstory: 'Three decades in foreign affairs taught Arthur that every problem has a negotiated solution. His calm demeanour and silver tongue make him nearly impossible to rattle.',
    traits: [
      { id: 'silver_tongue', name: 'Silver Tongue', icon: '\u{1F5E3}\uFE0F', description: 'Eloquent rhetoric deflects attacks and persuades voters.', effects: { campaignBonus: 0.1, attackResistance: 0.15 } },
      { id: 'policy_wonk', name: 'Policy Wonk', icon: '\u{1F4CB}', description: 'Deep understanding of governance accelerates reforms.', effects: { policySpeed: 0.15 } },
    ],
    baseApproval: 0.05,
    charisma: 0.7,
    experience: 0.9,
    scandalRisk: 0.1,
  },
  {
    id: 'farmer',
    name: 'Doug MacLeod',
    title: 'The Farmer',
    portrait: '\u{1F33E}',
    backstory: 'Fifth-generation wheat farmer from the Western Plains. Doug brings a plain-spoken authenticity that resonates with regional Australia. He has never broken a promise in his life.',
    traits: [
      { id: 'salt_of_earth', name: 'Salt of the Earth', icon: '\u{1F30D}', description: 'Genuine authenticity builds deep voter loyalty.', effects: { loyaltyBonus: 0.2 } },
      { id: 'regional_champion', name: 'Regional Champion', icon: '\u{1F3D8}\uFE0F', description: 'Strong ties to regional communities boost campaign effectiveness.', effects: { campaignBonus: 0.1 } },
    ],
    baseApproval: 0.1,
    charisma: 0.5,
    experience: 0.5,
    scandalRisk: 0.15,
  },
  {
    id: 'doctor',
    name: 'Dr. Sarah Okonkwo',
    title: 'The Doctor',
    portrait: '\u2695\uFE0F',
    backstory: 'A former Chief Medical Officer who steered Australia through two health crises. Sarah is universally respected for her calm expertise and evidence-based approach to every challenge.',
    traits: [
      { id: 'trusted_expert', name: 'Trusted Expert', icon: '\u{1FA7A}', description: 'Public trust in medical expertise lifts baseline approval.', effects: { approvalBonus: 0.1 } },
      { id: 'evidence_based', name: 'Evidence-Based', icon: '\u{1F52C}', description: 'Scientific rigour speeds up policy implementation.', effects: { policySpeed: 0.1 } },
    ],
    baseApproval: 0.15,
    charisma: 0.6,
    experience: 0.7,
    scandalRisk: 0.1,
  },
  {
    id: 'lawyer',
    name: 'James Whitford',
    title: 'The Lawyer',
    portrait: '\u2696\uFE0F',
    backstory: 'Star barrister turned politician, James built his reputation defending the powerless against corporate interests. In Question Time, his cross-examination skills are devastating.',
    traits: [
      { id: 'legal_mind', name: 'Legal Mind', icon: '\u2696\uFE0F', description: 'Legal expertise provides strong resistance to political attacks.', effects: { attackResistance: 0.2 } },
      { id: 'cross_examiner', name: 'Cross-Examiner', icon: '\u{1F50D}', description: 'Forensic questioning skills sharpen campaign messaging.', effects: { campaignBonus: 0.1 } },
    ],
    baseApproval: 0.0,
    charisma: 0.6,
    experience: 0.8,
    scandalRisk: 0.3,
  },
  {
    id: 'teacher',
    name: 'Helen Park',
    title: 'The Teacher',
    portrait: '\u{1F4DA}',
    backstory: 'Beloved high school principal who ran for office after watching education funding get slashed year after year. Helen connects with everyday Australians like no one else.',
    traits: [
      { id: 'inspiring_speaker', name: 'Inspiring Speaker', icon: '\u{1F3A4}', description: 'Gift for communication strengthens campaign impact.', effects: { campaignBonus: 0.15 } },
      { id: 'community_builder', name: 'Community Builder', icon: '\u{1F3E0}', description: 'Deep community roots foster enduring voter loyalty.', effects: { loyaltyBonus: 0.1 } },
    ],
    baseApproval: 0.1,
    charisma: 0.7,
    experience: 0.5,
    scandalRisk: 0.1,
  },
  {
    id: 'engineer',
    name: 'Raj Patel',
    title: 'The Engineer',
    portrait: '\u{1F527}',
    backstory: 'Infrastructure genius who built half the rail network in Queensland. Raj approaches politics the way he approaches engineering: measure twice, cut once, deliver on time.',
    traits: [
      { id: 'problem_solver', name: 'Problem Solver', icon: '\u{1F527}', description: 'Systematic thinking dramatically speeds up policy delivery.', effects: { policySpeed: 0.2 } },
      { id: 'data_driven', name: 'Data Driven', icon: '\u{1F4CA}', description: 'Analytical approach generates additional political capital.', effects: { capitalBonus: 1 } },
    ],
    baseApproval: 0.05,
    charisma: 0.4,
    experience: 0.7,
    scandalRisk: 0.1,
  },
  {
    id: 'general',
    name: 'Margaret Steele',
    title: 'The General',
    portrait: '\u{1F396}\uFE0F',
    backstory: 'Retired Lieutenant General who commanded peacekeeping forces across three continents. Margaret brings military discipline and strategic thinking to the political battlefield.',
    traits: [
      { id: 'commanding_presence', name: 'Commanding Presence', icon: '\u{1F396}\uFE0F', description: 'Military bearing deflects political attacks.', effects: { attackResistance: 0.15 } },
      { id: 'strategic_mind', name: 'Strategic Mind', icon: '\u265F\uFE0F', description: 'Tactical thinking yields extra political capital each round.', effects: { capitalBonus: 1 } },
    ],
    baseApproval: 0.05,
    charisma: 0.6,
    experience: 0.9,
    scandalRisk: 0.2,
  },
  {
    id: 'entrepreneur',
    name: 'Liam Zhao',
    title: 'The Entrepreneur',
    portrait: '\u{1F4A1}',
    backstory: 'Tech startup founder who sold his AI company for billions before turning 35. Liam sees government as the ultimate platform problem waiting to be disrupted.',
    traits: [
      { id: 'venture_spirit', name: 'Venture Spirit', icon: '\u{1F680}', description: 'Startup hustle translates to powerful fundraising.', effects: { fundraiseBonus: 0.2 } },
      { id: 'disruptor', name: 'Disruptor', icon: '\u26A1', description: 'Move-fast mentality accelerates policy implementation.', effects: { policySpeed: 0.15 } },
    ],
    baseApproval: 0.0,
    charisma: 0.7,
    experience: 0.4,
    scandalRisk: 0.45,
  },
  {
    id: 'indigenous_elder',
    name: 'Uncle Kev Williams',
    title: 'The Elder',
    portrait: '\u{1FA83}',
    backstory: 'Respected Wiradjuri elder and land rights campaigner for over forty years. Uncle Kev brings ancient wisdom and a moral authority that transcends party politics.',
    traits: [
      { id: 'wisdom_of_country', name: 'Wisdom of Country', icon: '\u{1F33F}', description: 'Deep cultural authority lifts approval across all groups.', effects: { approvalBonus: 0.15 } },
      { id: 'bridge_builder', name: 'Bridge Builder', icon: '\u{1F309}', description: 'Ability to unite diverse communities builds lasting loyalty.', effects: { loyaltyBonus: 0.15 } },
    ],
    baseApproval: 0.2,
    charisma: 0.7,
    experience: 0.8,
    scandalRisk: 0.05,
  },
  {
    id: 'media_mogul',
    name: 'Diane Russo',
    title: 'The Media Mogul',
    portrait: '\u{1F4E1}',
    backstory: 'Former network executive who controlled the national news cycle for a decade. Diane knows how the media machine works because she built half of it.',
    traits: [
      { id: 'spin_doctor', name: 'Spin Doctor', icon: '\u{1F4F0}', description: 'Media mastery dramatically reduces negative press impact.', effects: { mediaSavvy: 0.3 } },
      { id: 'brand_power', name: 'Brand Power', icon: '\u{1F4FA}', description: 'Personal brand recognition sharpens campaign effectiveness.', effects: { campaignBonus: 0.1 } },
    ],
    baseApproval: -0.05,
    charisma: 0.6,
    experience: 0.6,
    scandalRisk: 0.5,
  },
  {
    id: 'grassroots_organiser',
    name: 'Tom\u00E1s Reyes',
    title: 'The Organiser',
    portrait: '\u{1F4E2}',
    backstory: 'Community organiser from Western Sydney who turned neighbourhood barbecues into political movements. Tom\u00E1s believes change starts at the kitchen table.',
    traits: [
      { id: 'door_knocker', name: 'Door Knocker', icon: '\u{1F6AA}', description: 'Tireless door-to-door campaigning dramatically boosts outreach.', effects: { campaignBonus: 0.2 } },
      { id: 'people_power', name: 'People Power', icon: '\u{1F465}', description: 'Genuine community connections build strong voter loyalty.', effects: { loyaltyBonus: 0.15 } },
    ],
    baseApproval: 0.1,
    charisma: 0.8,
    experience: 0.3,
    scandalRisk: 0.2,
  },
  {
    id: 'academic',
    name: 'Prof. Fiona Yang',
    title: 'The Academic',
    portrait: '\u{1F393}',
    backstory: 'Nobel-nominated economist from ANU who grew tired of writing policy papers that nobody read. Fiona decided if politicians would not listen to evidence, she would become one herself.',
    traits: [
      { id: 'research_excellence', name: 'Research Excellence', icon: '\u{1F4D6}', description: 'Academic rigour enables faster, better policy development.', effects: { policySpeed: 0.2 } },
      { id: 'intellectual_authority', name: 'Intellectual Authority', icon: '\u{1F393}', description: 'Scholarly credibility provides a baseline approval boost.', effects: { approvalBonus: 0.1 } },
    ],
    baseApproval: 0.05,
    charisma: 0.4,
    experience: 0.7,
    scandalRisk: 0.15,
  },
  {
    id: 'sports_star',
    name: 'Brodie Flanagan',
    title: 'The Sports Star',
    portrait: '\u{1F3C6}',
    backstory: 'Triple Brownlow medallist and national icon. Brodie is the most recognisable face in Australia and wants to use that platform to tackle the issues that matter.',
    traits: [
      { id: 'national_hero', name: 'National Hero', icon: '\u{1F3C5}', description: 'Celebrity status supercharges campaigning and lifts approval.', effects: { campaignBonus: 0.2, approvalBonus: 0.05 } },
      { id: 'team_player', name: 'Team Player', icon: '\u{1F91D}', description: 'Sporting ethos of teamwork builds strong voter loyalty.', effects: { loyaltyBonus: 0.1 } },
    ],
    baseApproval: 0.15,
    charisma: 0.9,
    experience: 0.2,
    scandalRisk: 0.5,
  },
];

// ============================================================
// PROPS
// ============================================================

interface LobbyProps {
  gameState: GameState | null;
  playerId: string;
  roomId: string | null;
  availableColors: PartyColorId[];
  error: string | null;
  onCreateRoom: (
    playerName: string, partyName: string, colorId: string,
    socialIdeology: string, economicIdeology: string, leaderId?: string,
  ) => void;
  onJoinRoom: (
    roomId: string, playerName: string, partyName: string, colorId: string,
    socialIdeology: string, economicIdeology: string, leaderId?: string,
  ) => void;
  onStartGame: () => void;
  onStartSinglePlayer: (
    playerName: string, partyName: string, colorId: string,
    socialIdeology: string, economicIdeology: string, leaderId: string,
    config: Record<string, any>,
  ) => void;
}

// ============================================================
// SMALL UI HELPERS
// ============================================================

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 w-8 uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${value * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] focus:ring-offset-2 ${
        value ? 'bg-[#1B3A8C]' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
          value ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-150 ${
            value === opt.value
              ? 'bg-[#1B3A8C] text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <React.Fragment key={step}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
              step === current
                ? 'bg-[#1B3A8C] text-white shadow-md'
                : step < current
                ? 'bg-[#1B3A8C]/20 text-[#1B3A8C]'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {step < current ? '\u2713' : step}
          </div>
          {step < total && (
            <div
              className={`w-12 h-0.5 rounded-full transition-colors duration-200 ${
                step < current ? 'bg-[#1B3A8C]/30' : 'bg-gray-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function TraitTooltip({ trait }: { trait: LeaderTraitLocal }) {
  return (
    <span className="group/tip relative cursor-help">
      <span className="text-lg leading-none">{trait.icon}</span>
      <span className="invisible group-hover/tip:visible opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-20 pointer-events-none">
        <span className="font-semibold">{trait.name}</span>
        <br />
        {trait.description}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}

// ============================================================
// MAIN LOBBY COMPONENT
// ============================================================

type LobbyView = 'landing' | 'character' | 'sp_settings' | 'mp_choice' | 'mp_join' | 'waiting';
type FlowMode = 'single' | 'multi';

export function Lobby({
  gameState,
  playerId,
  roomId,
  availableColors,
  error,
  onCreateRoom,
  onJoinRoom,
  onStartGame,
  onStartSinglePlayer,
}: LobbyProps) {
  // Navigation
  const [view, setView] = useState<LobbyView>('landing');
  const [flowMode, setFlowMode] = useState<FlowMode | null>(null);
  const [charStep, setCharStep] = useState<1 | 2 | 3>(1);

  // Character data
  const [selectedLeaderId, setSelectedLeaderId] = useState<string | null>(null);
  const [partyName, setPartyName] = useState('');
  const [selectedColor, setSelectedColor] = useState<PartyColorId | null>(null);
  const [socialIdeology, setSocialIdeology] = useState<SocialIdeology>('progressive');
  const [economicIdeology, setEconomicIdeology] = useState<EconomicIdeology>('market');
  const [playerName, setPlayerName] = useState('');

  // Single player settings
  const [aiCount, setAiCount] = useState(3);
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('normal');
  const [gameLength, setGameLength] = useState<number>(16);
  const [electionCycle, setElectionCycle] = useState<number>(3);
  const [enableDilemmas, setEnableDilemmas] = useState(true);
  const [enableMediaCycle, setEnableMediaCycle] = useState(true);
  const [enableSituations, setEnableSituations] = useState(true);

  // Multiplayer
  const [roomCode, setRoomCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Derived
  const selectedLeader = LEADER_POOL.find((l) => l.id === selectedLeaderId) || null;
  const isHost = gameState?.players?.[0]?.id === playerId;

  // Pick first available color on load
  useEffect(() => {
    if (availableColors.length > 0 && !selectedColor) {
      setSelectedColor(availableColors[0]);
    }
  }, [availableColors, selectedColor]);

  // --------------------------------------------------------
  // ACTIONS
  // --------------------------------------------------------

  const handleStartFlow = (mode: FlowMode) => {
    setFlowMode(mode);
    setView('character');
    setCharStep(1);
  };

  const handleCharacterNext = () => {
    if (charStep === 1 && selectedLeaderId) {
      setCharStep(2);
    } else if (charStep === 2 && partyName.trim() && selectedColor) {
      setCharStep(3);
    } else if (charStep === 3 && playerName.trim()) {
      if (flowMode === 'single') {
        setView('sp_settings');
      } else {
        setView('mp_choice');
      }
    }
  };

  const handleCharacterBack = () => {
    if (charStep > 1) {
      setCharStep((charStep - 1) as 1 | 2);
    } else {
      setView('landing');
      setFlowMode(null);
    }
  };

  const handleCreateRoom = () => {
    if (playerName.trim() && partyName.trim() && selectedColor && selectedLeaderId) {
      onCreateRoom(
        playerName.trim(),
        partyName.trim(),
        selectedColor,
        socialIdeology,
        economicIdeology,
        selectedLeaderId,
      );
    }
  };

  const handleJoinRoom = () => {
    if (playerName.trim() && partyName.trim() && selectedColor && roomCode.trim() && selectedLeaderId) {
      onJoinRoom(
        roomCode.trim().toUpperCase(),
        playerName.trim(),
        partyName.trim(),
        selectedColor,
        socialIdeology,
        economicIdeology,
        selectedLeaderId,
      );
    }
  };

  const handleStartSinglePlayer = () => {
    if (!selectedLeaderId || !playerName.trim() || !partyName.trim() || !selectedColor) return;
    onStartSinglePlayer(
      playerName.trim(),
      partyName.trim(),
      selectedColor,
      socialIdeology,
      economicIdeology,
      selectedLeaderId,
      {
        aiPlayerCount: aiCount,
        aiDifficulty,
        totalRounds: gameLength,
        electionCycle,
        enableDilemmas,
        enableMediaCycle,
        enableSituations,
        isSinglePlayer: true,
      },
    );
  };

  const copyRoomCode = () => {
    if (gameState) {
      navigator.clipboard.writeText(gameState.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // --------------------------------------------------------
  // ERROR BANNER
  // --------------------------------------------------------

  const errorBanner = error ? (
    <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
      {error}
    </div>
  ) : null;

  // --------------------------------------------------------
  // WAITING ROOM (multiplayer, once in a room)
  // --------------------------------------------------------

  if (roomId && gameState && gameState.roomId) {
    const colorForPlayer = (colorId: string) =>
      PARTY_COLORS.find((c) => c.id === colorId)?.hex || '#888';

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Waiting Room</h1>
            <p className="text-gray-500 mt-1">Share the room code with your friends</p>
          </div>

          {errorBanner}

          {/* Room Code Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 text-center">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Room Code
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-mono font-bold text-[#1B3A8C] tracking-[0.3em]">
                {gameState.roomId}
              </span>
              <button
                onClick={copyRoomCode}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Players */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Players ({gameState.players.length}/5)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gameState.players.map((player, idx) => {
                const leaderDef = LEADER_POOL.find((l) => l.id === player.leader?.definitionId);
                return (
                  <div
                    key={player.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      player.id === playerId
                        ? 'border-[#1B3A8C]/30 bg-blue-50/50'
                        : 'border-gray-100 bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
                        style={{ backgroundColor: player.color + '20' }}
                      >
                        {leaderDef?.portrait || player.leader?.portrait || '\u{1F464}'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-sm truncate">
                          {player.name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {player.playerName}
                          {leaderDef ? ` \u2022 ${leaderDef.title}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: player.color }}
                        />
                        {idx === 0 && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1B3A8C] bg-[#1B3A8C]/10 px-2 py-0.5 rounded-full">
                            Host
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      <span className="capitalize">{player.socialIdeology}</span>
                      {' / '}
                      <span className="capitalize">{player.economicIdeology}</span>
                    </div>
                  </div>
                );
              })}

              {/* Empty slots */}
              {Array.from({ length: 5 - gameState.players.length }).map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  className="p-4 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center min-h-[80px]"
                >
                  <span className="text-sm text-gray-300">Waiting for player...</span>
                </div>
              ))}
            </div>
          </div>

          {/* Game Settings */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Game Settings</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wider">Seats</div>
                <div className="font-semibold text-gray-900 mt-0.5">{gameState.totalSeats}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wider">Rounds</div>
                <div className="font-semibold text-gray-900 mt-0.5">{gameState.totalRounds}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wider">Majority</div>
                <div className="font-semibold text-gray-900 mt-0.5">
                  {Math.ceil(gameState.totalSeats / 2)} seats
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wider">Events</div>
                <div className="font-semibold text-gray-900 mt-0.5">Enabled</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="text-center">
            {isHost ? (
              <button
                onClick={onStartGame}
                disabled={gameState.players.length < 2}
                className="px-8 py-3 bg-[#1B3A8C] text-white font-semibold rounded-xl hover:bg-[#152d6e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                Start Game
              </button>
            ) : (
              <p className="text-gray-400 text-sm">Waiting for the host to start the game...</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Loading state if roomId is set but gameState hasn't arrived
  if (roomId && !gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#1B3A8C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Connecting to room...</p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // LANDING PAGE
  // --------------------------------------------------------

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Title */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1B3A8C] mb-4">
              <span className="text-3xl">{'\u{1F3DB}\uFE0F'}</span>
            </div>
            <h1 className="text-5xl font-bold text-gray-900 tracking-tight">THE HOUSE</h1>
            <p className="text-gray-500 mt-2 text-lg">Australian House of Representatives</p>
            <p className="text-gray-400 mt-1 text-sm">A political strategy game</p>
          </div>

          {errorBanner}

          {/* Game Mode Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Single Player */}
            <button
              onClick={() => handleStartFlow('single')}
              className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-left hover:shadow-md hover:border-[#1B3A8C]/20 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-[#1B3A8C]/10 transition-colors">
                <span className="text-2xl">{'\u{1F3AE}'}</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Single Player</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Play against AI opponents. Adjust difficulty and settings to your liking.
              </p>
              <div className="mt-4 text-sm font-medium text-[#1B3A8C] flex items-center gap-1 group-hover:gap-2 transition-all">
                Get started <span>{'\u2192'}</span>
              </div>
            </button>

            {/* Multiplayer */}
            <button
              onClick={() => handleStartFlow('multi')}
              className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-left hover:shadow-md hover:border-[#1B3A8C]/20 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-[#1B3A8C]/10 transition-colors">
                <span className="text-2xl">{'\u{1F465}'}</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Multiplayer</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Create or join a room with friends. Compete for control of Parliament.
              </p>
              <div className="mt-4 text-sm font-medium text-[#1B3A8C] flex items-center gap-1 group-hover:gap-2 transition-all">
                Get started <span>{'\u2192'}</span>
              </div>
            </button>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 text-xs text-gray-400">
            151 seats &middot; 2-5 players &middot; Dynamic elections
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // CHARACTER CREATOR
  // --------------------------------------------------------

  if (view === 'character') {
    const stepLabels = ['Choose Leader', 'Party Setup', 'Your Name'];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleCharacterBack}
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
            >
              <span>{'\u2190'}</span> Back
            </button>
            <div className="text-sm text-gray-400">
              Step {charStep} of 3: {stepLabels[charStep - 1]}
            </div>
          </div>

          {/* Step Indicator */}
          <div className="mb-8">
            <StepIndicator current={charStep} total={3} />
          </div>

          {errorBanner}

          {/* Step 1: Choose Leader */}
          {charStep === 1 && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Choose Your Leader</h2>
                <p className="text-gray-500 mt-1">Select a leader to represent your party</p>
              </div>

              {/* Leader Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                {LEADER_POOL.map((leader) => (
                  <button
                    key={leader.id}
                    onClick={() => setSelectedLeaderId(leader.id)}
                    className={`bg-white rounded-xl border-2 p-3 text-left transition-all duration-150 hover:shadow-md ${
                      selectedLeaderId === leader.id
                        ? 'border-[#1B3A8C] shadow-md ring-2 ring-[#1B3A8C]/20'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {/* Portrait */}
                    <div className="text-center mb-2">
                      <span className="text-4xl leading-none">{leader.portrait}</span>
                    </div>

                    {/* Name & Title */}
                    <div className="text-center mb-2">
                      <div className="font-semibold text-gray-900 text-sm truncate">{leader.name}</div>
                      <div className="text-xs text-gray-400 truncate">{leader.title}</div>
                    </div>

                    {/* Traits */}
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      {leader.traits.map((trait) => (
                        <TraitTooltip key={trait.id} trait={trait} />
                      ))}
                    </div>

                    {/* Stats */}
                    <div className="space-y-1">
                      <StatBar label="CHA" value={leader.charisma} color="#3B82F6" />
                      <StatBar label="EXP" value={leader.experience} color="#10B981" />
                      <StatBar label="SCN" value={leader.scandalRisk} color="#EF4444" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Selected Leader Detail */}
              {selectedLeader && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                  <div className="flex items-start gap-4">
                    <span className="text-5xl shrink-0">{selectedLeader.portrait}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-gray-900">{selectedLeader.name}</h3>
                      <p className="text-sm text-[#1B3A8C] font-medium">{selectedLeader.title}</p>
                      <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                        {selectedLeader.backstory}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedLeader.traits.map((trait) => (
                          <span
                            key={trait.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-100 rounded-full text-xs text-gray-700"
                          >
                            <span>{trait.icon}</span>
                            <span className="font-medium">{trait.name}</span>
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3 max-w-sm">
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider">Charisma</div>
                          <div className="mt-1">
                            <StatBar label="" value={selectedLeader.charisma} color="#3B82F6" />
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider">Experience</div>
                          <div className="mt-1">
                            <StatBar label="" value={selectedLeader.experience} color="#10B981" />
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider">Scandal Risk</div>
                          <div className="mt-1">
                            <StatBar label="" value={selectedLeader.scandalRisk} color="#EF4444" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Next Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleCharacterNext}
                  disabled={!selectedLeaderId}
                  className="px-8 py-3 bg-[#1B3A8C] text-white font-semibold rounded-xl hover:bg-[#152d6e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Next: Party Setup
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Party Setup */}
          {charStep === 2 && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Party Setup</h2>
                <p className="text-gray-500 mt-1">Define your political party</p>
              </div>

              <div className="max-w-lg mx-auto space-y-6">
                {/* Party Name */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Party Name
                  </label>
                  <input
                    type="text"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    placeholder="e.g. Progressive Alliance"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] focus:border-transparent transition-shadow"
                    maxLength={30}
                  />
                </div>

                {/* Party Colour */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Party Colour
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {PARTY_COLORS.map((color) => {
                      const isAvailable =
                        availableColors.length === 0 || availableColors.includes(color.id);
                      return (
                        <button
                          key={color.id}
                          onClick={() => isAvailable && setSelectedColor(color.id)}
                          disabled={!isAvailable}
                          title={color.name}
                          className={`w-10 h-10 rounded-full transition-all duration-150 ${
                            !isAvailable
                              ? 'opacity-20 cursor-not-allowed'
                              : selectedColor === color.id
                              ? 'ring-2 ring-offset-2 ring-[#1B3A8C] scale-110'
                              : 'hover:scale-105 cursor-pointer'
                          }`}
                          style={{ backgroundColor: color.hex }}
                        />
                      );
                    })}
                  </div>
                  {selectedColor && (
                    <div className="mt-2 text-xs text-gray-400">
                      {PARTY_COLORS.find((c) => c.id === selectedColor)?.name}
                    </div>
                  )}
                </div>

                {/* Ideology */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-4">
                    Ideology
                  </label>
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                        Social Stance
                      </div>
                      <SegmentedControl<SocialIdeology>
                        options={[
                          { label: 'Progressive', value: 'progressive' },
                          { label: 'Conservative', value: 'conservative' },
                        ]}
                        value={socialIdeology}
                        onChange={setSocialIdeology}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                        Economic Policy
                      </div>
                      <SegmentedControl<EconomicIdeology>
                        options={[
                          { label: 'Free Market', value: 'market' },
                          { label: 'Interventionist', value: 'interventionist' },
                        ]}
                        value={economicIdeology}
                        onChange={setEconomicIdeology}
                      />
                    </div>
                  </div>
                </div>

                {/* Next Button */}
                <div className="flex justify-between">
                  <button
                    onClick={handleCharacterBack}
                    className="px-6 py-3 text-gray-500 font-medium hover:text-gray-900 transition-colors"
                  >
                    {'\u2190'} Back
                  </button>
                  <button
                    onClick={handleCharacterNext}
                    disabled={!partyName.trim() || !selectedColor}
                    className="px-8 py-3 bg-[#1B3A8C] text-white font-semibold rounded-xl hover:bg-[#152d6e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    Next: Your Name
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Player Name */}
          {charStep === 3 && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Your Name</h2>
                <p className="text-gray-500 mt-1">What should we call you?</p>
              </div>

              <div className="max-w-lg mx-auto space-y-6">
                {/* Player Name */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Player Name
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="e.g. John"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] focus:border-transparent transition-shadow"
                    maxLength={20}
                  />
                </div>

                {/* Summary Card */}
                {selectedLeader && selectedColor && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                      Character Summary
                    </div>
                    <div className="flex items-center gap-4">
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
                        style={{
                          backgroundColor:
                            (PARTY_COLORS.find((c) => c.id === selectedColor)?.hex || '#888') + '20',
                        }}
                      >
                        {selectedLeader.portrait}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-gray-900">
                          {playerName || 'Your Name'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {selectedLeader.name} &middot; {selectedLeader.title}
                        </div>
                        <div className="text-sm text-gray-400">
                          {partyName || 'Party Name'}
                        </div>
                      </div>
                      <div
                        className="w-6 h-6 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            PARTY_COLORS.find((c) => c.id === selectedColor)?.hex || '#888',
                        }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 bg-gray-50 border border-gray-100 rounded-full text-xs text-gray-600 capitalize">
                        {socialIdeology}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 bg-gray-50 border border-gray-100 rounded-full text-xs text-gray-600 capitalize">
                        {economicIdeology === 'market' ? 'Free Market' : 'Interventionist'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex justify-between">
                  <button
                    onClick={handleCharacterBack}
                    className="px-6 py-3 text-gray-500 font-medium hover:text-gray-900 transition-colors"
                  >
                    {'\u2190'} Back
                  </button>
                  <button
                    onClick={handleCharacterNext}
                    disabled={!playerName.trim()}
                    className="px-8 py-3 bg-[#1B3A8C] text-white font-semibold rounded-xl hover:bg-[#152d6e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    {flowMode === 'single' ? 'Next: Game Settings' : 'Next: Room Setup'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // SINGLE PLAYER SETTINGS
  // --------------------------------------------------------

  if (view === 'sp_settings') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => { setView('character'); setCharStep(3); }}
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
            >
              <span>{'\u2190'}</span> Back
            </button>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Game Settings</h2>
            <p className="text-gray-500 mt-1">Configure your single player experience</p>
          </div>

          {errorBanner}

          <div className="space-y-4">
            {/* AI Opponents */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">AI Opponents</div>
                  <div className="text-xs text-gray-400">Number of computer-controlled parties</div>
                </div>
                <SegmentedControl<number>
                  options={[
                    { label: '2', value: 2 },
                    { label: '3', value: 3 },
                    { label: '4', value: 4 },
                    { label: '5', value: 5 },
                  ]}
                  value={aiCount}
                  onChange={setAiCount}
                />
              </div>
            </div>

            {/* AI Difficulty */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">Difficulty</div>
                  <div className="text-xs text-gray-400">How smart the AI opponents are</div>
                </div>
                <SegmentedControl<AIDifficulty>
                  options={[
                    { label: 'Easy', value: 'easy' },
                    { label: 'Normal', value: 'normal' },
                    { label: 'Hard', value: 'hard' },
                  ]}
                  value={aiDifficulty}
                  onChange={setAiDifficulty}
                />
              </div>
            </div>

            {/* Game Length */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">Game Length</div>
                  <div className="text-xs text-gray-400">Total number of rounds</div>
                </div>
                <SegmentedControl<number>
                  options={[
                    { label: 'Short (8)', value: 8 },
                    { label: 'Standard (16)', value: 16 },
                    { label: 'Long (24)', value: 24 },
                  ]}
                  value={gameLength}
                  onChange={setGameLength}
                />
              </div>
            </div>

            {/* Election Cycle */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">Election Cycle</div>
                  <div className="text-xs text-gray-400">Rounds between elections</div>
                </div>
                <SegmentedControl<number>
                  options={[
                    { label: 'Every 2', value: 2 },
                    { label: 'Every 3', value: 3 },
                    { label: 'Every 4', value: 4 },
                  ]}
                  value={electionCycle}
                  onChange={setElectionCycle}
                />
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              <div className="font-semibold text-gray-900 text-sm mb-1">Features</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-700">Dilemmas</div>
                  <div className="text-xs text-gray-400">Tough choice events for the government</div>
                </div>
                <Toggle value={enableDilemmas} onChange={setEnableDilemmas} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-700">Media Cycle</div>
                  <div className="text-xs text-gray-400">News focus shifts and spotlight on issues</div>
                </div>
                <Toggle value={enableMediaCycle} onChange={setEnableMediaCycle} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-700">Situations</div>
                  <div className="text-xs text-gray-400">Dynamic crises and booms that emerge</div>
                </div>
                <Toggle value={enableSituations} onChange={setEnableSituations} />
              </div>
            </div>

            {/* Start Button */}
            <div className="pt-2">
              <button
                onClick={handleStartSinglePlayer}
                className="w-full py-4 bg-[#1B3A8C] text-white text-lg font-semibold rounded-xl hover:bg-[#152d6e] transition-colors shadow-sm"
              >
                Start Game
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // MULTIPLAYER CHOICE (Create or Join)
  // --------------------------------------------------------

  if (view === 'mp_choice') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => { setView('character'); setCharStep(3); }}
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
            >
              <span>{'\u2190'}</span> Back
            </button>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Multiplayer</h2>
            <p className="text-gray-500 mt-1">Create a new room or join an existing one</p>
          </div>

          {errorBanner}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Create Room */}
            <button
              onClick={handleCreateRoom}
              className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-left hover:shadow-md hover:border-[#1B3A8C]/20 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-[#1B3A8C]/10 transition-colors">
                <span className="text-2xl">{'\u2795'}</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-1">Create Room</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Start a new game and invite others with a room code.
              </p>
              <div className="mt-4 text-sm font-medium text-[#1B3A8C] flex items-center gap-1 group-hover:gap-2 transition-all">
                Create <span>{'\u2192'}</span>
              </div>
            </button>

            {/* Join Room */}
            <button
              onClick={() => setView('mp_join')}
              className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-left hover:shadow-md hover:border-[#1B3A8C]/20 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-[#1B3A8C]/10 transition-colors">
                <span className="text-2xl">{'\u{1F517}'}</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-1">Join Room</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Enter a room code to join a friend's game.
              </p>
              <div className="mt-4 text-sm font-medium text-[#1B3A8C] flex items-center gap-1 group-hover:gap-2 transition-all">
                Join <span>{'\u2192'}</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // MULTIPLAYER JOIN (enter room code)
  // --------------------------------------------------------

  if (view === 'mp_join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setView('mp_choice')}
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
            >
              <span>{'\u2190'}</span> Back
            </button>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Join Room</h2>
            <p className="text-gray-500 mt-1">Enter the room code shared by the host</p>
          </div>

          {errorBanner}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Room Code</label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-character code"
              className="w-full px-4 py-4 border border-gray-200 rounded-lg text-gray-900 text-center text-2xl font-mono tracking-[0.3em] uppercase placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1B3A8C] focus:border-transparent transition-shadow"
              maxLength={6}
            />

            <button
              onClick={handleJoinRoom}
              disabled={!roomCode.trim() || roomCode.trim().length < 4}
              className="w-full mt-4 py-3 bg-[#1B3A8C] text-white font-semibold rounded-xl hover:bg-[#152d6e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              Join Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // FALLBACK
  // --------------------------------------------------------

  return null;
}
