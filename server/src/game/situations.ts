// ============================================================
// THE HOUSE - Australian Political Strategy Game
// Situation definitions: 20 dynamic conditions that emerge
// when input conditions are met (Democracy 4-style)
// ============================================================

import { SituationDefinition, PolicyEffect } from '../types';

// ============================================================
// HELPER: build a PolicyEffect with sensible defaults
// ============================================================

function fx(
  targetId: string,
  multiplier: number,
  formula: PolicyEffect['formula'] = 'linear',
  delay: number = 0,
  inertia: number = 0.3,
): PolicyEffect {
  return { targetId, multiplier, formula, delay, inertia };
}

// ============================================================
// ALL SITUATIONS
// ============================================================

export function getAllSituations(): SituationDefinition[] {
  return [

    // --------------------------------------------------------
    // 1. RECESSION (crisis)
    // --------------------------------------------------------
    {
      id: 'recession',
      name: 'Recession',
      description:
        'The economy has contracted for two consecutive quarters. Business closures mount, consumer spending collapses, and the government faces intense pressure to stimulate growth.',
      icon: '\ud83d\udcc9',
      severityType: 'crisis',
      triggerThreshold: 0.65,
      deactivateThreshold: 0.45,
      inputs: [
        { sourceId: 'gdpGrowth', weight: -0.55 },
        { sourceId: 'consumerConfidence', weight: -0.30 },
        { sourceId: 'businessConfidence', weight: -0.15 },
      ],
      effects: [
        fx('unemployment', 0.35, 'linear', 0, 0.4),
        fx('consumerConfidence', -0.25, 'linear', 0, 0.3),
        fx('businessConfidence', -0.20, 'linear', 0, 0.3),
        fx('budgetBalance', -0.20, 'sqrt', 1, 0.5),
      ],
      headline: 'ECONOMY IN RECESSION: GDP contracts as downturn bites',
      voterReactions: [
        { groupId: 'working_class', delta: -0.25 },
        { groupId: 'business_owners', delta: -0.20 },
        { groupId: 'suburban_families', delta: -0.15 },
        { groupId: 'young_voters', delta: -0.10 },
      ],
    },

    // --------------------------------------------------------
    // 2. HOUSING CRISIS (crisis)
    // --------------------------------------------------------
    {
      id: 'housing_crisis',
      name: 'Housing Crisis',
      description:
        'Housing affordability has reached breaking point. Rents consume half of average incomes, home ownership is a distant dream for most young Australians, and homelessness rises sharply.',
      icon: '\ud83c\udfe0',
      severityType: 'crisis',
      triggerThreshold: 0.60,
      deactivateThreshold: 0.40,
      inputs: [
        { sourceId: 'housing', weight: -0.60 },
        { sourceId: 'inflation', weight: 0.20 },
        { sourceId: 'interestRate', weight: 0.20 },
      ],
      effects: [
        fx('homelessness', 0.30, 'linear', 0, 0.4),
        fx('consumerConfidence', -0.15, 'linear', 0, 0.3),
        fx('services', -0.10, 'sqrt', 1, 0.3),
      ],
      headline: 'HOUSING CRISIS: Median house price now 12x average income',
      voterReactions: [
        { groupId: 'young_voters', delta: -0.30 },
        { groupId: 'suburban_families', delta: -0.25 },
        { groupId: 'working_class', delta: -0.20 },
      ],
    },

    // --------------------------------------------------------
    // 3. HEALTHCARE CRISIS (crisis)
    // --------------------------------------------------------
    {
      id: 'healthcare_crisis',
      name: 'Healthcare Crisis',
      description:
        'Hospital emergency departments are overwhelmed, wait times for elective surgery stretch to years, and bulk-billing GPs are vanishing from suburbs across the country.',
      icon: '\ud83c\udfe5',
      severityType: 'crisis',
      triggerThreshold: 0.62,
      deactivateThreshold: 0.42,
      inputs: [
        { sourceId: 'healthcare', weight: -0.55 },
        { sourceId: 'health_bulk_billing', weight: -0.25 },
        { sourceId: 'health_aged_care', weight: -0.20 },
      ],
      effects: [
        fx('consumerConfidence', -0.15, 'linear', 0, 0.3),
        fx('budgetBalance', -0.10, 'linear', 1, 0.4),
        fx('services', -0.10, 'sqrt', 0, 0.3),
      ],
      headline: 'HEALTHCARE IN CRISIS: Emergency departments buckling under pressure',
      voterReactions: [
        { groupId: 'retirees', delta: -0.25 },
        { groupId: 'suburban_families', delta: -0.20 },
        { groupId: 'public_sector', delta: -0.20 },
        { groupId: 'working_class', delta: -0.15 },
      ],
    },

    // --------------------------------------------------------
    // 4. DEBT CRISIS (crisis)
    // --------------------------------------------------------
    {
      id: 'debt_crisis',
      name: 'Debt Crisis',
      description:
        'Public debt has spiralled to unsustainable levels. Credit rating agencies issue downgrades, bond yields surge, and the cost of servicing debt crowds out essential spending.',
      icon: '\ud83d\udcb8',
      severityType: 'crisis',
      triggerThreshold: 0.70,
      deactivateThreshold: 0.50,
      inputs: [
        { sourceId: 'publicDebt', weight: 0.60 },
        { sourceId: 'budgetBalance', weight: -0.25 },
        { sourceId: 'interestRate', weight: 0.15 },
      ],
      effects: [
        fx('inflation', 0.15, 'linear', 1, 0.4),
        fx('interestRate', 0.20, 'sqrt', 0, 0.5),
        fx('businessConfidence', -0.20, 'linear', 0, 0.3),
        fx('gdpGrowth', -0.15, 'linear', 1, 0.4),
      ],
      headline: 'DEBT CRISIS: Australia loses AAA credit rating',
      voterReactions: [
        { groupId: 'business_owners', delta: -0.25 },
        { groupId: 'retirees', delta: -0.15 },
        { groupId: 'urban_professionals', delta: -0.15 },
      ],
    },

    // --------------------------------------------------------
    // 5. CRIME WAVE (crisis)
    // --------------------------------------------------------
    {
      id: 'crime_wave',
      name: 'Crime Wave',
      description:
        'Violent crime and property offences surge across major cities. Carjackings, home invasions, and youth gang activity dominate the evening news, eroding public confidence.',
      icon: '\ud83d\udd2b',
      severityType: 'crisis',
      triggerThreshold: 0.63,
      deactivateThreshold: 0.43,
      inputs: [
        { sourceId: 'unemployment', weight: 0.35 },
        { sourceId: 'housing', weight: -0.25 },
        { sourceId: 'consumerConfidence', weight: -0.20 },
        { sourceId: 'education', weight: -0.20 },
      ],
      effects: [
        fx('consumerConfidence', -0.20, 'linear', 0, 0.3),
        fx('businessConfidence', -0.15, 'linear', 0, 0.3),
        fx('services', -0.10, 'sqrt', 0, 0.3),
      ],
      headline: 'CRIME WAVE: Violent offences spike in major cities',
      voterReactions: [
        { groupId: 'suburban_families', delta: -0.25 },
        { groupId: 'retirees', delta: -0.20 },
        { groupId: 'business_owners', delta: -0.15 },
        { groupId: 'rural_regional', delta: -0.10 },
      ],
    },

    // --------------------------------------------------------
    // 6. BRAIN DRAIN (crisis)
    // --------------------------------------------------------
    {
      id: 'brain_drain',
      name: 'Brain Drain',
      description:
        'Australia\'s brightest talent is emigrating to Silicon Valley, London, and Singapore. Low R&D investment, high taxes, and limited career prospects drive a generation of graduates offshore.',
      icon: '\u2708\ufe0f',
      severityType: 'crisis',
      triggerThreshold: 0.60,
      deactivateThreshold: 0.40,
      inputs: [
        { sourceId: 'education', weight: -0.30 },
        { sourceId: 'technology', weight: -0.30 },
        { sourceId: 'tax_income_cut', weight: -0.20 },
        { sourceId: 'edu_research', weight: -0.20 },
      ],
      effects: [
        fx('technology', -0.20, 'linear', 1, 0.5),
        fx('gdpGrowth', -0.10, 'sqrt', 2, 0.5),
        fx('education', -0.10, 'linear', 1, 0.4),
      ],
      headline: 'BRAIN DRAIN: Top graduates flee Australia for overseas opportunities',
      voterReactions: [
        { groupId: 'urban_professionals', delta: -0.20 },
        { groupId: 'young_voters', delta: -0.20 },
        { groupId: 'business_owners', delta: -0.15 },
      ],
    },

    // --------------------------------------------------------
    // 7. CLIMATE EMERGENCY (crisis)
    // --------------------------------------------------------
    {
      id: 'climate_emergency',
      name: 'Climate Emergency',
      description:
        'Extreme weather events intensify dramatically. The Great Barrier Reef suffers mass bleaching, Murray-Darling water levels plummet, and summer heatwaves break record after record.',
      icon: '\ud83c\udf21\ufe0f',
      severityType: 'crisis',
      triggerThreshold: 0.65,
      deactivateThreshold: 0.45,
      inputs: [
        { sourceId: 'climate_ets', weight: -0.20 },
        { sourceId: 'climate_renewable_target', weight: -0.20 },
        { sourceId: 'climate_carbon_tax', weight: -0.20 },
        { sourceId: 'energy', weight: -0.20 },
        { sourceId: 'climate_reef', weight: -0.20 },
      ],
      effects: [
        fx('agriculture', -0.25, 'linear', 0, 0.4),
        fx('healthcare', -0.10, 'sqrt', 1, 0.4),
        fx('consumerConfidence', -0.10, 'linear', 0, 0.3),
        fx('drought', 0.20, 'threshold', 0, 0.5),
      ],
      headline: 'CLIMATE EMERGENCY: Extreme weather events devastate communities',
      voterReactions: [
        { groupId: 'young_voters', delta: -0.25 },
        { groupId: 'rural_regional', delta: -0.20 },
        { groupId: 'urban_professionals', delta: -0.15 },
      ],
    },

    // --------------------------------------------------------
    // 8. DROUGHT (crisis)
    // --------------------------------------------------------
    {
      id: 'drought',
      name: 'Drought',
      description:
        'Prolonged drought grips eastern Australia. Dam levels fall below 30%, water restrictions tighten to the highest level, and agricultural communities face ruin as crops fail and livestock perish.',
      icon: '\u2600\ufe0f',
      severityType: 'crisis',
      triggerThreshold: 0.58,
      deactivateThreshold: 0.38,
      inputs: [
        { sourceId: 'infra_water', weight: -0.35 },
        { sourceId: 'climate_emergency', weight: 0.35 },
        { sourceId: 'agriculture', weight: -0.30 },
      ],
      effects: [
        fx('agriculture', -0.35, 'linear', 0, 0.3),
        fx('gdpGrowth', -0.10, 'sqrt', 1, 0.4),
        fx('consumerConfidence', -0.10, 'linear', 0, 0.3),
        fx('bushfire', 0.25, 'threshold', 0, 0.3),
      ],
      headline: 'DROUGHT EMERGENCY: Water restrictions as dam levels hit record lows',
      voterReactions: [
        { groupId: 'rural_regional', delta: -0.30 },
        { groupId: 'suburban_families', delta: -0.10 },
        { groupId: 'business_owners', delta: -0.10 },
      ],
    },

    // --------------------------------------------------------
    // 9. BUSHFIRE (crisis)
    // --------------------------------------------------------
    {
      id: 'bushfire',
      name: 'Bushfire Emergency',
      description:
        'Catastrophic bushfires rage across multiple states. Entire towns are lost, millions of hectares burn, wildlife populations collapse, and smoke blankets capital cities for weeks.',
      icon: '\ud83d\udd25',
      severityType: 'crisis',
      triggerThreshold: 0.70,
      deactivateThreshold: 0.45,
      inputs: [
        { sourceId: 'drought', weight: 0.45 },
        { sourceId: 'climate_emergency', weight: 0.30 },
        { sourceId: 'agriculture', weight: -0.25 },
      ],
      effects: [
        fx('agriculture', -0.30, 'linear', 0, 0.2),
        fx('healthcare', -0.15, 'linear', 0, 0.3),
        fx('consumerConfidence', -0.25, 'linear', 0, 0.2),
        fx('gdpGrowth', -0.15, 'sqrt', 0, 0.3),
        fx('budgetBalance', -0.20, 'linear', 0, 0.3),
      ],
      headline: 'BUSHFIRE CATASTROPHE: States declare emergency as fires rage',
      voterReactions: [
        { groupId: 'rural_regional', delta: -0.30 },
        { groupId: 'suburban_families', delta: -0.20 },
        { groupId: 'retirees', delta: -0.15 },
        { groupId: 'young_voters', delta: -0.15 },
      ],
    },

    // --------------------------------------------------------
    // 10. HOMELESSNESS (problem)
    // --------------------------------------------------------
    {
      id: 'homelessness',
      name: 'Homelessness Epidemic',
      description:
        'Tent cities appear in parks across Sydney and Melbourne. Shelter waiting lists stretch for years, and rough sleeping numbers reach record highs as the safety net fails.',
      icon: '\ud83c\udfd5\ufe0f',
      severityType: 'problem',
      triggerThreshold: 0.60,
      deactivateThreshold: 0.42,
      inputs: [
        { sourceId: 'housing', weight: -0.40 },
        { sourceId: 'unemployment', weight: 0.25 },
        { sourceId: 'welfare_jobseeker', weight: -0.15 },
        { sourceId: 'welfare_rent_assistance', weight: -0.20 },
      ],
      effects: [
        fx('crime_wave', 0.15, 'sqrt', 1, 0.4),
        fx('consumerConfidence', -0.10, 'linear', 0, 0.3),
        fx('healthcare', -0.08, 'linear', 1, 0.4),
      ],
      headline: 'HOMELESSNESS EPIDEMIC: Tent cities spread through capital cities',
      voterReactions: [
        { groupId: 'young_voters', delta: -0.20 },
        { groupId: 'urban_professionals', delta: -0.15 },
        { groupId: 'suburban_families', delta: -0.15 },
        { groupId: 'public_sector', delta: -0.10 },
      ],
    },

    // --------------------------------------------------------
    // 11. OBESITY EPIDEMIC (problem)
    // --------------------------------------------------------
    {
      id: 'obesity_epidemic',
      name: 'Obesity Epidemic',
      description:
        'More than one in three adult Australians are now obese. Type 2 diabetes rates soar, the healthcare system groans under chronic disease burden, and life expectancy begins to fall.',
      icon: '\ud83c\udf54',
      severityType: 'problem',
      triggerThreshold: 0.58,
      deactivateThreshold: 0.40,
      inputs: [
        { sourceId: 'healthcare', weight: -0.35 },
        { sourceId: 'health_pbs_expansion', weight: -0.20 },
        { sourceId: 'education', weight: -0.20 },
        { sourceId: 'consumerConfidence', weight: -0.25 },
      ],
      effects: [
        fx('healthcare', -0.20, 'linear', 1, 0.5),
        fx('budgetBalance', -0.10, 'sqrt', 1, 0.5),
        fx('gdpGrowth', -0.05, 'linear', 2, 0.5),
      ],
      headline: 'OBESITY EPIDEMIC: Chronic disease costs blow out health budget',
      voterReactions: [
        { groupId: 'retirees', delta: -0.10 },
        { groupId: 'suburban_families', delta: -0.10 },
        { groupId: 'public_sector', delta: -0.10 },
      ],
    },

    // --------------------------------------------------------
    // 12. MENTAL HEALTH CRISIS (problem)
    // --------------------------------------------------------
    {
      id: 'mental_health_crisis',
      name: 'Mental Health Crisis',
      description:
        'Anxiety and depression rates reach epidemic levels, particularly among young Australians. Psychologist wait times exceed six months, and suicide rates climb to alarming highs.',
      icon: '\ud83e\udde0',
      severityType: 'problem',
      triggerThreshold: 0.60,
      deactivateThreshold: 0.40,
      inputs: [
        { sourceId: 'health_mental', weight: -0.35 },
        { sourceId: 'unemployment', weight: 0.25 },
        { sourceId: 'housing', weight: -0.20 },
        { sourceId: 'consumerConfidence', weight: -0.20 },
      ],
      effects: [
        fx('consumerConfidence', -0.12, 'linear', 0, 0.3),
        fx('gdpGrowth', -0.08, 'sqrt', 1, 0.4),
        fx('healthcare', -0.10, 'linear', 0, 0.4),
      ],
      headline: 'MENTAL HEALTH CRISIS: Record demand overwhelms psychology services',
      voterReactions: [
        { groupId: 'young_voters', delta: -0.25 },
        { groupId: 'urban_professionals', delta: -0.15 },
        { groupId: 'working_class', delta: -0.15 },
        { groupId: 'public_sector', delta: -0.10 },
      ],
    },

    // --------------------------------------------------------
    // 13. IMMIGRATION CRISIS (problem)
    // --------------------------------------------------------
    {
      id: 'immigration_crisis',
      name: 'Immigration Crisis',
      description:
        'Record net migration strains infrastructure and housing. Public services are overwhelmed, community tensions rise, and the immigration debate becomes toxic and divisive.',
      icon: '\ud83c\uddf3\ud83c\uddfa',
      severityType: 'problem',
      triggerThreshold: 0.65,
      deactivateThreshold: 0.45,
      inputs: [
        { sourceId: 'immig_skilled', weight: 0.25 },
        { sourceId: 'immig_temp_worker', weight: 0.20 },
        { sourceId: 'immig_student_visa', weight: 0.20 },
        { sourceId: 'housing', weight: -0.35 },
      ],
      effects: [
        fx('housing', -0.15, 'linear', 0, 0.3),
        fx('services', -0.10, 'linear', 0, 0.3),
        fx('consumerConfidence', -0.10, 'linear', 0, 0.3),
        fx('crime_wave', 0.08, 'sqrt', 1, 0.4),
      ],
      headline: 'IMMIGRATION CRISIS: Record arrivals strain housing and services',
      voterReactions: [
        { groupId: 'working_class', delta: -0.20 },
        { groupId: 'suburban_families', delta: -0.20 },
        { groupId: 'rural_regional', delta: -0.15 },
        { groupId: 'retirees', delta: -0.15 },
      ],
    },

    // --------------------------------------------------------
    // 14. ECONOMIC BOOM (boom)
    // --------------------------------------------------------
    {
      id: 'economic_boom',
      name: 'Economic Boom',
      description:
        'Australia enjoys a sustained period of strong economic growth. Unemployment falls to record lows, wages rise, consumer spending surges, and the budget returns to surplus.',
      icon: '\ud83d\udcb0',
      severityType: 'boom',
      triggerThreshold: 0.65,
      deactivateThreshold: 0.45,
      inputs: [
        { sourceId: 'gdpGrowth', weight: 0.45 },
        { sourceId: 'consumerConfidence', weight: 0.30 },
        { sourceId: 'businessConfidence', weight: 0.25 },
      ],
      effects: [
        fx('unemployment', -0.25, 'linear', 0, 0.3),
        fx('budgetBalance', 0.20, 'sqrt', 1, 0.4),
        fx('consumerConfidence', 0.10, 'linear', 0, 0.3),
      ],
      headline: 'ECONOMIC BOOM: Growth surges as confidence soars',
      voterReactions: [
        { groupId: 'business_owners', delta: 0.25 },
        { groupId: 'working_class', delta: 0.20 },
        { groupId: 'suburban_families', delta: 0.15 },
        { groupId: 'young_voters', delta: 0.10 },
      ],
    },

    // --------------------------------------------------------
    // 15. TECH BOOM (boom)
    // --------------------------------------------------------
    {
      id: 'tech_boom',
      name: 'Tech Boom',
      description:
        'Australia\'s technology sector explodes with growth. Start-ups flourish, venture capital pours in, and the country establishes itself as a regional hub for AI, quantum computing, and biotech.',
      icon: '\ud83d\ude80',
      severityType: 'boom',
      triggerThreshold: 0.65,
      deactivateThreshold: 0.45,
      inputs: [
        { sourceId: 'technology', weight: 0.40 },
        { sourceId: 'edu_research', weight: 0.25 },
        { sourceId: 'edu_digital_stem', weight: 0.20 },
        { sourceId: 'infra_nbn_fibre', weight: 0.15 },
      ],
      effects: [
        fx('gdpGrowth', 0.15, 'linear', 1, 0.4),
        fx('businessConfidence', 0.15, 'linear', 0, 0.3),
        fx('technology', 0.10, 'sqrt', 0, 0.3),
      ],
      headline: 'TECH BOOM: Australian start-ups attract record investment',
      voterReactions: [
        { groupId: 'urban_professionals', delta: 0.25 },
        { groupId: 'business_owners', delta: 0.20 },
        { groupId: 'young_voters', delta: 0.20 },
      ],
    },

    // --------------------------------------------------------
    // 16. MINING BOOM (boom)
    // --------------------------------------------------------
    {
      id: 'mining_boom',
      name: 'Mining Boom',
      description:
        'Global demand for Australian iron ore, lithium, and rare earths drives a massive mining investment cycle. Fly-in-fly-out workers flood regional towns, and royalties fill state coffers.',
      icon: '\u26cf\ufe0f',
      severityType: 'boom',
      triggerThreshold: 0.60,
      deactivateThreshold: 0.40,
      inputs: [
        { sourceId: 'trade_critical_minerals', weight: 0.30 },
        { sourceId: 'trade_export_diversify', weight: 0.25 },
        { sourceId: 'tax_mining', weight: -0.20 },
        { sourceId: 'businessConfidence', weight: 0.25 },
      ],
      effects: [
        fx('gdpGrowth', 0.20, 'linear', 0, 0.3),
        fx('unemployment', -0.15, 'sqrt', 0, 0.3),
        fx('budgetBalance', 0.15, 'linear', 1, 0.4),
        fx('manufacturing', -0.10, 'linear', 2, 0.5),
      ],
      headline: 'MINING BOOM: Commodity exports hit record highs',
      voterReactions: [
        { groupId: 'rural_regional', delta: 0.25 },
        { groupId: 'business_owners', delta: 0.20 },
        { groupId: 'working_class', delta: 0.15 },
        { groupId: 'young_voters', delta: -0.05 },
      ],
    },

    // --------------------------------------------------------
    // 17. TOURISM BOOM (boom)
    // --------------------------------------------------------
    {
      id: 'tourism_boom',
      name: 'Tourism Boom',
      description:
        'International tourists flock to Australia in record numbers. Hotels fill, airlines add routes, and regional communities benefit from visitors exploring beyond the major cities.',
      icon: '\ud83c\udfdd\ufe0f',
      severityType: 'boom',
      triggerThreshold: 0.65,
      deactivateThreshold: 0.45,
      inputs: [
        { sourceId: 'defence_pacific', weight: 0.20 },
        { sourceId: 'trade_eu_fta', weight: 0.20 },
        { sourceId: 'infra_high_speed_rail', weight: 0.15 },
        { sourceId: 'climate_reef', weight: 0.25 },
        { sourceId: 'services', weight: 0.20 },
      ],
      effects: [
        fx('gdpGrowth', 0.12, 'linear', 0, 0.3),
        fx('services', 0.15, 'sqrt', 0, 0.3),
        fx('unemployment', -0.08, 'linear', 0, 0.3),
      ],
      headline: 'TOURISM BOOM: Visitor numbers shatter records',
      voterReactions: [
        { groupId: 'business_owners', delta: 0.20 },
        { groupId: 'rural_regional', delta: 0.15 },
        { groupId: 'working_class', delta: 0.10 },
      ],
    },

    // --------------------------------------------------------
    // 18. EDUCATION EXPORT BOOM (boom)
    // --------------------------------------------------------
    {
      id: 'education_export_boom',
      name: 'Education Export Boom',
      description:
        'Australia\'s universities become the destination of choice for international students across Asia and beyond. Education becomes the nation\'s third-largest export, injecting billions into the economy.',
      icon: '\ud83c\udf93',
      severityType: 'boom',
      triggerThreshold: 0.65,
      deactivateThreshold: 0.45,
      inputs: [
        { sourceId: 'education', weight: 0.30 },
        { sourceId: 'edu_uni_free', weight: 0.20 },
        { sourceId: 'edu_research', weight: 0.20 },
        { sourceId: 'immig_student_visa', weight: 0.30 },
      ],
      effects: [
        fx('gdpGrowth', 0.10, 'linear', 1, 0.4),
        fx('services', 0.12, 'sqrt', 0, 0.3),
        fx('education', 0.08, 'linear', 1, 0.4),
      ],
      headline: 'EDUCATION EXPORT BOOM: International student numbers hit record high',
      voterReactions: [
        { groupId: 'urban_professionals', delta: 0.15 },
        { groupId: 'business_owners', delta: 0.15 },
        { groupId: 'public_sector', delta: 0.10 },
        { groupId: 'young_voters', delta: 0.10 },
      ],
    },

    // --------------------------------------------------------
    // 19. GREEN TRANSITION (good)
    // --------------------------------------------------------
    {
      id: 'green_transition',
      name: 'Green Energy Transition',
      description:
        'Australia rapidly transitions to renewable energy, becoming a clean energy superpower. Solar and wind farms dot the landscape, green hydrogen exports begin, and emissions plummet.',
      icon: '\ud83c\udf3f',
      severityType: 'good',
      triggerThreshold: 0.65,
      deactivateThreshold: 0.45,
      inputs: [
        { sourceId: 'climate_renewable_target', weight: 0.30 },
        { sourceId: 'climate_ets', weight: 0.25 },
        { sourceId: 'climate_ev_subsidy', weight: 0.15 },
        { sourceId: 'climate_carbon_tax', weight: 0.15 },
        { sourceId: 'energy', weight: 0.15 },
      ],
      effects: [
        fx('technology', 0.15, 'linear', 1, 0.4),
        fx('energy', 0.20, 'sqrt', 1, 0.4),
        fx('agriculture', 0.05, 'linear', 2, 0.5),
        fx('manufacturing', -0.08, 'linear', 0, 0.3),
      ],
      headline: 'GREEN TRANSITION: Renewables overtake fossil fuels in energy mix',
      voterReactions: [
        { groupId: 'young_voters', delta: 0.25 },
        { groupId: 'urban_professionals', delta: 0.15 },
        { groupId: 'rural_regional', delta: -0.10 },
        { groupId: 'working_class', delta: -0.05 },
      ],
    },

    // --------------------------------------------------------
    // 20. AGING POPULATION (neutral)
    // --------------------------------------------------------
    {
      id: 'aging_population',
      name: 'Aging Population',
      description:
        'Australia\'s population is steadily aging as baby boomers retire en masse. The dependency ratio climbs, pension costs escalate, and the healthcare system faces mounting demand from chronic age-related conditions.',
      icon: '\ud83d\udc74',
      severityType: 'neutral',
      triggerThreshold: 0.35,
      deactivateThreshold: 0.20,
      inputs: [
        { sourceId: 'healthcare', weight: -0.20 },
        { sourceId: 'health_aged_care', weight: -0.25 },
        { sourceId: 'immig_skilled', weight: -0.20 },
        { sourceId: 'welfare_pension', weight: 0.35 },
      ],
      effects: [
        fx('healthcare', -0.12, 'linear', 0, 0.5),
        fx('budgetBalance', -0.15, 'sqrt', 0, 0.5),
        fx('gdpGrowth', -0.08, 'linear', 1, 0.5),
        fx('unemployment', -0.05, 'inverse', 0, 0.4),
      ],
      headline: 'AGING POPULATION: Dependency ratio hits historic high',
      voterReactions: [
        { groupId: 'retirees', delta: -0.10 },
        { groupId: 'working_class', delta: -0.10 },
        { groupId: 'suburban_families', delta: -0.05 },
        { groupId: 'public_sector', delta: -0.10 },
      ],
    },

  ];
}
