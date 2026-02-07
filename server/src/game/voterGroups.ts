// ============================================================
// THE HOUSE — Voter Group Definitions
// 15 overlapping voter groups representing the Australian electorate
// ============================================================

import { VoterGroupDefinition, VoterConcern } from '../types';

export function getAllVoterGroups(): VoterGroupDefinition[] {
  return [
    // ──────────────────────────────────────────────
    // 1. Workers & Unions
    // ──────────────────────────────────────────────
    {
      id: 'workers',
      name: 'Workers & Unions',
      icon: '⚒️',
      description:
        'Trade union members, labourers, and wage earners who depend on strong workplace protections, fair pay, and full employment. A traditional Labor base with deep roots in the union movement.',
      basePopulation: 15,
      concerns: [
        { nodeId: 'minimum_wage', weight: 0.9, desiresHigh: true },
        { nodeId: 'unemployment', weight: 0.85, desiresHigh: false },
        { nodeId: 'equality', weight: 0.7, desiresHigh: true },
        { nodeId: 'unemployment_benefits', weight: 0.6, desiresHigh: true },
        { nodeId: 'income_tax', weight: 0.4, desiresHigh: false },
        { nodeId: 'poverty_rate', weight: 0.65, desiresHigh: false },
      ],
      socialLeaning: 0.3,
      economicLeaning: 0.7,
      persuadability: 0.4,
      populationModifiers: [
        { sourceId: 'unemployment', weight: 0.3 },
        { sourceId: 'gdp_growth', weight: 0.2 },
      ],
    },

    // ──────────────────────────────────────────────
    // 2. Business Owners
    // ──────────────────────────────────────────────
    {
      id: 'business_owners',
      name: 'Business Owners',
      icon: '💼',
      description:
        'Small and medium enterprise operators, entrepreneurs, and corporate managers who want lower regulation, lower taxes, and a competitive economy that rewards initiative.',
      basePopulation: 8,
      concerns: [
        { nodeId: 'corporate_tax', weight: 0.9, desiresHigh: false },
        { nodeId: 'business_subsidies', weight: 0.7, desiresHigh: true },
        { nodeId: 'gdp_growth', weight: 0.85, desiresHigh: true },
        { nodeId: 'trade_tariffs', weight: 0.6, desiresHigh: false },
        { nodeId: 'small_business_grants', weight: 0.75, desiresHigh: true },
        { nodeId: 'consumer_confidence', weight: 0.5, desiresHigh: true },
        { nodeId: 'minimum_wage', weight: 0.4, desiresHigh: false },
      ],
      socialLeaning: -0.2,
      economicLeaning: -0.8,
      persuadability: 0.3,
      populationModifiers: [
        { sourceId: 'gdp_growth', weight: 0.3 },
        { sourceId: 'consumer_confidence', weight: 0.2 },
      ],
    },

    // ──────────────────────────────────────────────
    // 3. Farmers & Rural
    // ──────────────────────────────────────────────
    {
      id: 'farmers',
      name: 'Farmers & Rural',
      icon: '🌾',
      description:
        'Agricultural producers, graziers, and rural community members whose livelihoods depend on water access, subsidies, and protection from foreign competition. The backbone of regional Australia.',
      basePopulation: 7,
      concerns: [
        { nodeId: 'agricultural_subsidies', weight: 0.9, desiresHigh: true },
        { nodeId: 'water_infrastructure', weight: 0.85, desiresHigh: true },
        { nodeId: 'trade_tariffs', weight: 0.6, desiresHigh: true },
        { nodeId: 'road_funding', weight: 0.55, desiresHigh: true },
        { nodeId: 'infrastructure_quality', weight: 0.5, desiresHigh: true },
        { nodeId: 'environment_quality', weight: 0.45, desiresHigh: true },
        { nodeId: 'nbn_internet', weight: 0.4, desiresHigh: true },
      ],
      socialLeaning: -0.3,
      economicLeaning: 0.2,
      persuadability: 0.35,
      populationModifiers: [
        { sourceId: 'agricultural_subsidies', weight: 0.2 },
        { sourceId: 'gdp_growth', weight: -0.1 },
      ],
    },

    // ──────────────────────────────────────────────
    // 4. Environmentalists
    // ──────────────────────────────────────────────
    {
      id: 'environmentalists',
      name: 'Environmentalists',
      icon: '🌿',
      description:
        'Climate activists, conservation advocates, and ecologically conscious voters who prioritise the natural environment, emissions reduction, and renewable energy above all else.',
      basePopulation: 10,
      concerns: [
        { nodeId: 'carbon_tax', weight: 0.9, desiresHigh: true },
        { nodeId: 'emissions_standards', weight: 0.85, desiresHigh: true },
        { nodeId: 'renewable_energy', weight: 0.9, desiresHigh: true },
        { nodeId: 'environment_quality', weight: 0.95, desiresHigh: true },
        { nodeId: 'conservation_funding', weight: 0.8, desiresHigh: true },
        { nodeId: 'national_parks', weight: 0.6, desiresHigh: true },
        { nodeId: 'recycling_programs', weight: 0.5, desiresHigh: true },
        { nodeId: 'mining_royalties', weight: 0.45, desiresHigh: true },
      ],
      socialLeaning: 0.8,
      economicLeaning: 0.3,
      persuadability: 0.25,
      populationModifiers: [
        { sourceId: 'environment_quality', weight: -0.3 },
        { sourceId: 'education_quality', weight: 0.15 },
      ],
    },

    // ──────────────────────────────────────────────
    // 5. Retirees & Pensioners
    // ──────────────────────────────────────────────
    {
      id: 'retirees',
      name: 'Retirees & Pensioners',
      icon: '🏡',
      description:
        'Older Australians living on superannuation, the aged pension, or personal savings. They need stable healthcare, low inflation, and secure housing. A large and highly persuadable group.',
      basePopulation: 18,
      concerns: [
        { nodeId: 'aged_pension', weight: 0.9, desiresHigh: true },
        { nodeId: 'health_quality', weight: 0.85, desiresHigh: true },
        { nodeId: 'medicare_funding', weight: 0.8, desiresHigh: true },
        { nodeId: 'inflation', weight: 0.75, desiresHigh: false },
        { nodeId: 'housing_affordability', weight: 0.6, desiresHigh: true },
        { nodeId: 'crime_rate', weight: 0.55, desiresHigh: false },
        { nodeId: 'hospital_funding', weight: 0.65, desiresHigh: true },
      ],
      socialLeaning: -0.1,
      economicLeaning: 0.2,
      persuadability: 0.7,
      populationModifiers: [
        { sourceId: 'health_quality', weight: 0.1 },
      ],
    },

    // ──────────────────────────────────────────────
    // 6. Students & Youth
    // ──────────────────────────────────────────────
    {
      id: 'students',
      name: 'Students & Youth',
      icon: '🎓',
      description:
        'University and TAFE students, recent graduates, and young Australians facing housing stress, student debt, and an uncertain job market. Strongly progressive and climate-conscious.',
      basePopulation: 12,
      concerns: [
        { nodeId: 'university_subsidies', weight: 0.85, desiresHigh: true },
        { nodeId: 'education_quality', weight: 0.8, desiresHigh: true },
        { nodeId: 'housing_affordability', weight: 0.9, desiresHigh: true },
        { nodeId: 'environment_quality', weight: 0.6, desiresHigh: true },
        { nodeId: 'tafe_funding', weight: 0.55, desiresHigh: true },
        { nodeId: 'unemployment', weight: 0.65, desiresHigh: false },
        { nodeId: 'public_transport', weight: 0.5, desiresHigh: true },
      ],
      socialLeaning: 0.6,
      economicLeaning: 0.4,
      persuadability: 0.55,
      populationModifiers: [
        { sourceId: 'university_subsidies', weight: 0.2 },
        { sourceId: 'education_quality', weight: 0.15 },
      ],
    },

    // ──────────────────────────────────────────────
    // 7. Wealthy & Investors
    // ──────────────────────────────────────────────
    {
      id: 'wealthy',
      name: 'Wealthy & Investors',
      icon: '💎',
      description:
        'High-net-worth individuals, property investors, and shareholders who benefit most from low capital gains taxes, low income taxes, and strong economic growth. Small in number but politically influential.',
      basePopulation: 5,
      concerns: [
        { nodeId: 'capital_gains_tax', weight: 0.95, desiresHigh: false },
        { nodeId: 'income_tax', weight: 0.85, desiresHigh: false },
        { nodeId: 'gdp_growth', weight: 0.8, desiresHigh: true },
        { nodeId: 'corporate_tax', weight: 0.6, desiresHigh: false },
        { nodeId: 'luxury_tax', weight: 0.7, desiresHigh: false },
        { nodeId: 'inflation', weight: 0.5, desiresHigh: false },
      ],
      socialLeaning: -0.3,
      economicLeaning: -0.9,
      persuadability: 0.2,
      populationModifiers: [
        { sourceId: 'gdp_growth', weight: 0.15 },
      ],
    },

    // ──────────────────────────────────────────────
    // 8. Religious & Traditionalists
    // ──────────────────────────────────────────────
    {
      id: 'religious',
      name: 'Religious & Traditionalists',
      icon: '⛪',
      description:
        'Church-going Australians, social conservatives, and cultural traditionalists who favour strong borders, family values, and public order. Wary of rapid social change.',
      basePopulation: 8,
      concerns: [
        { nodeId: 'immigration_level', weight: 0.7, desiresHigh: false },
        { nodeId: 'border_security', weight: 0.85, desiresHigh: true },
        { nodeId: 'crime_rate', weight: 0.65, desiresHigh: false },
        { nodeId: 'police_funding', weight: 0.6, desiresHigh: true },
        { nodeId: 'family_tax_benefit', weight: 0.7, desiresHigh: true },
        { nodeId: 'school_funding', weight: 0.5, desiresHigh: true },
        { nodeId: 'counter_terrorism', weight: 0.55, desiresHigh: true },
      ],
      socialLeaning: -0.7,
      economicLeaning: 0.1,
      persuadability: 0.3,
      populationModifiers: [
        { sourceId: 'immigration_level', weight: -0.15 },
      ],
    },

    // ──────────────────────────────────────────────
    // 9. Healthcare Workers
    // ──────────────────────────────────────────────
    {
      id: 'healthcare_workers',
      name: 'Healthcare Workers',
      icon: '🏥',
      description:
        'Nurses, doctors, allied health professionals, and aged care workers who see firsthand the impact of health funding decisions. Advocates for universal healthcare and mental health services.',
      basePopulation: 5,
      concerns: [
        { nodeId: 'medicare_funding', weight: 0.95, desiresHigh: true },
        { nodeId: 'hospital_funding', weight: 0.9, desiresHigh: true },
        { nodeId: 'mental_health_funding', weight: 0.85, desiresHigh: true },
        { nodeId: 'health_quality', weight: 0.8, desiresHigh: true },
        { nodeId: 'preventive_health', weight: 0.7, desiresHigh: true },
        { nodeId: 'minimum_wage', weight: 0.45, desiresHigh: true },
      ],
      socialLeaning: 0.4,
      economicLeaning: 0.6,
      persuadability: 0.35,
      populationModifiers: [
        { sourceId: 'health_quality', weight: 0.15 },
        { sourceId: 'hospital_funding', weight: 0.1 },
      ],
    },

    // ──────────────────────────────────────────────
    // 10. Indigenous Australians
    // ──────────────────────────────────────────────
    {
      id: 'indigenous',
      name: 'Indigenous Australians',
      icon: '🪃',
      description:
        'Aboriginal and Torres Strait Islander peoples who seek justice, equality, better welfare outcomes, and protection of Country. A small but culturally significant group with low persuadability.',
      basePopulation: 3,
      concerns: [
        { nodeId: 'equality', weight: 0.95, desiresHigh: true },
        { nodeId: 'housing_assistance', weight: 0.85, desiresHigh: true },
        { nodeId: 'conservation_funding', weight: 0.75, desiresHigh: true },
        { nodeId: 'health_quality', weight: 0.8, desiresHigh: true },
        { nodeId: 'education_quality', weight: 0.7, desiresHigh: true },
        { nodeId: 'poverty_rate', weight: 0.8, desiresHigh: false },
        { nodeId: 'legal_aid', weight: 0.6, desiresHigh: true },
      ],
      socialLeaning: 0.8,
      economicLeaning: 0.5,
      persuadability: 0.15,
      populationModifiers: [
        { sourceId: 'equality', weight: 0.1 },
      ],
    },

    // ──────────────────────────────────────────────
    // 11. Immigrants & Multicultural
    // ──────────────────────────────────────────────
    {
      id: 'immigrants',
      name: 'Immigrants & Multicultural',
      icon: '🌏',
      description:
        'First- and second-generation migrants and multicultural communities who value an open immigration system, refugee protections, and equal opportunity regardless of background.',
      basePopulation: 10,
      concerns: [
        { nodeId: 'immigration_level', weight: 0.85, desiresHigh: true },
        { nodeId: 'refugee_intake', weight: 0.8, desiresHigh: true },
        { nodeId: 'equality', weight: 0.75, desiresHigh: true },
        { nodeId: 'international_relations', weight: 0.5, desiresHigh: true },
        { nodeId: 'foreign_aid', weight: 0.45, desiresHigh: true },
        { nodeId: 'education_quality', weight: 0.55, desiresHigh: true },
        { nodeId: 'housing_affordability', weight: 0.6, desiresHigh: true },
      ],
      socialLeaning: 0.5,
      economicLeaning: 0.1,
      persuadability: 0.45,
      populationModifiers: [
        { sourceId: 'immigration_level', weight: 0.4 },
        { sourceId: 'refugee_intake', weight: 0.15 },
      ],
    },

    // ──────────────────────────────────────────────
    // 12. Parents & Families
    // ──────────────────────────────────────────────
    {
      id: 'parents',
      name: 'Parents & Families',
      icon: '👪',
      description:
        'Working parents, single-parent households, and families raising children. Their top priorities are affordable childcare, good schools, safe neighbourhoods, and housing they can actually afford.',
      basePopulation: 20,
      concerns: [
        { nodeId: 'childcare_subsidies', weight: 0.9, desiresHigh: true },
        { nodeId: 'school_funding', weight: 0.85, desiresHigh: true },
        { nodeId: 'housing_affordability', weight: 0.9, desiresHigh: true },
        { nodeId: 'crime_rate', weight: 0.7, desiresHigh: false },
        { nodeId: 'family_tax_benefit', weight: 0.75, desiresHigh: true },
        { nodeId: 'health_quality', weight: 0.6, desiresHigh: true },
        { nodeId: 'education_quality', weight: 0.65, desiresHigh: true },
        { nodeId: 'inflation', weight: 0.5, desiresHigh: false },
      ],
      socialLeaning: 0.1,
      economicLeaning: 0.2,
      persuadability: 0.75,
      populationModifiers: [
        { sourceId: 'childcare_subsidies', weight: 0.1 },
        { sourceId: 'housing_affordability', weight: 0.15 },
      ],
    },

    // ──────────────────────────────────────────────
    // 13. Public Servants
    // ──────────────────────────────────────────────
    {
      id: 'public_servants',
      name: 'Public Servants',
      icon: '🏛️',
      description:
        'Federal and state government employees, Centrelink and ATO staff, defence civilians, and bureaucrats who believe in the role of government and depend on well-funded public institutions.',
      basePopulation: 8,
      concerns: [
        { nodeId: 'education_quality', weight: 0.7, desiresHigh: true },
        { nodeId: 'school_funding', weight: 0.65, desiresHigh: true },
        { nodeId: 'hospital_funding', weight: 0.7, desiresHigh: true },
        { nodeId: 'medicare_funding', weight: 0.65, desiresHigh: true },
        { nodeId: 'unemployment_benefits', weight: 0.5, desiresHigh: true },
        { nodeId: 'disability_support', weight: 0.55, desiresHigh: true },
        { nodeId: 'health_quality', weight: 0.6, desiresHigh: true },
      ],
      socialLeaning: 0.2,
      economicLeaning: 0.7,
      persuadability: 0.4,
      populationModifiers: [
        { sourceId: 'gdp_growth', weight: 0.1 },
      ],
    },

    // ──────────────────────────────────────────────
    // 14. Tech & Innovation
    // ──────────────────────────────────────────────
    {
      id: 'tech_workers',
      name: 'Tech & Innovation',
      icon: '💻',
      description:
        'Software engineers, startup founders, scientists, and digital professionals who want world-class internet, strong R&D funding, and quality universities to keep Australia competitive globally.',
      basePopulation: 6,
      concerns: [
        { nodeId: 'rnd_funding', weight: 0.9, desiresHigh: true },
        { nodeId: 'nbn_internet', weight: 0.85, desiresHigh: true },
        { nodeId: 'technology_level', weight: 0.8, desiresHigh: true },
        { nodeId: 'university_subsidies', weight: 0.65, desiresHigh: true },
        { nodeId: 'research_grants', weight: 0.7, desiresHigh: true },
        { nodeId: 'immigration_level', weight: 0.4, desiresHigh: true },
        { nodeId: 'education_quality', weight: 0.55, desiresHigh: true },
      ],
      socialLeaning: 0.4,
      economicLeaning: -0.3,
      persuadability: 0.45,
      populationModifiers: [
        { sourceId: 'technology_level', weight: 0.3 },
        { sourceId: 'rnd_funding', weight: 0.15 },
      ],
    },

    // ──────────────────────────────────────────────
    // 15. Motorists & Commuters
    // ──────────────────────────────────────────────
    {
      id: 'motorists',
      name: 'Motorists & Commuters',
      icon: '🚗',
      description:
        'Suburban and regional commuters, tradies with utes, truckers, and anyone whose daily life depends on roads, fuel prices, and transport infrastructure. Sceptical of carbon taxes that raise fuel costs.',
      basePopulation: 15,
      concerns: [
        { nodeId: 'road_funding', weight: 0.9, desiresHigh: true },
        { nodeId: 'public_transport', weight: 0.7, desiresHigh: true },
        { nodeId: 'carbon_tax', weight: 0.65, desiresHigh: false },
        { nodeId: 'infrastructure_quality', weight: 0.8, desiresHigh: true },
        { nodeId: 'gst', weight: 0.45, desiresHigh: false },
        { nodeId: 'inflation', weight: 0.55, desiresHigh: false },
      ],
      socialLeaning: -0.1,
      economicLeaning: -0.1,
      persuadability: 0.6,
      populationModifiers: [
        { sourceId: 'infrastructure_quality', weight: 0.2 },
        { sourceId: 'road_funding', weight: 0.15 },
      ],
    },
  ];
}
