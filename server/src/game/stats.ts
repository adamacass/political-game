// ============================================================
// THE HOUSE — Statistics Definitions
// 15 computed statistics that form the middle layer of the
// simulation web: Policies → Stats → Situations / Voter Groups
//
// Australian Democracy 4-style political simulation
// ============================================================

import { StatDefinition, PolicyEffect } from '../types';

export function getAllStats(): StatDefinition[] {
  return [
    // --------------------------------------------------------
    // 1. GDP Growth
    // --------------------------------------------------------
    {
      id: 'gdp_growth',
      name: 'GDP Growth',
      icon: '📈',
      value: 0.55,
      prevValue: 0.55,
      defaultValue: 0.55,
      displayFormat: 'rate',
      displayMin: -5,
      displayMax: 8,
      isGood: true,
      effects: [
        {
          targetId: 'unemployment',
          multiplier: -0.4,
          formula: 'linear',
          delay: 0,
          inertia: 0.5,
        },
        {
          targetId: 'consumer_confidence',
          multiplier: 0.3,
          formula: 'linear',
          delay: 0,
          inertia: 0.4,
        },
        {
          targetId: 'poverty_rate',
          multiplier: -0.2,
          formula: 'sqrt',
          delay: 0,
          inertia: 0.6,
        },
      ],
    },

    // --------------------------------------------------------
    // 2. Unemployment
    // --------------------------------------------------------
    {
      id: 'unemployment',
      name: 'Unemployment',
      icon: '👷',
      value: 0.25,
      prevValue: 0.25,
      defaultValue: 0.25,
      displayFormat: 'rate',
      displayMin: 0,
      displayMax: 20,
      isGood: false,
      effects: [
        {
          targetId: 'crime_rate',
          multiplier: 0.2,
          formula: 'linear',
          delay: 0,
          inertia: 0.5,
        },
        {
          targetId: 'consumer_confidence',
          multiplier: -0.3,
          formula: 'linear',
          delay: 0,
          inertia: 0.4,
        },
        {
          targetId: 'poverty_rate',
          multiplier: 0.3,
          formula: 'linear',
          delay: 0,
          inertia: 0.5,
        },
      ],
    },

    // --------------------------------------------------------
    // 3. Inflation
    // --------------------------------------------------------
    {
      id: 'inflation',
      name: 'Inflation',
      icon: '💹',
      value: 0.35,
      prevValue: 0.35,
      defaultValue: 0.35,
      displayFormat: 'rate',
      displayMin: -2,
      displayMax: 15,
      isGood: false,
      effects: [
        {
          targetId: 'housing_affordability',
          multiplier: -0.2,
          formula: 'linear',
          delay: 0,
          inertia: 0.4,
        },
        {
          targetId: 'consumer_confidence',
          multiplier: -0.2,
          formula: 'linear',
          delay: 0,
          inertia: 0.3,
        },
        {
          targetId: 'equality',
          multiplier: -0.15,
          formula: 'threshold',
          delay: 0,
          inertia: 0.5,
        },
      ],
    },

    // --------------------------------------------------------
    // 4. Public Debt
    // --------------------------------------------------------
    {
      id: 'public_debt',
      name: 'Public Debt',
      icon: '🏦',
      value: 0.35,
      prevValue: 0.35,
      defaultValue: 0.35,
      displayFormat: 'currency',
      displayMin: 0,
      displayMax: 200,
      isGood: false,
      effects: [
        {
          targetId: 'inflation',
          multiplier: 0.1,
          formula: 'linear',
          delay: 0,
          inertia: 0.6,
        },
        {
          targetId: 'international_relations',
          multiplier: -0.2,
          formula: 'threshold',
          delay: 0,
          inertia: 0.5,
        },
      ],
    },

    // --------------------------------------------------------
    // 5. Crime Rate
    // --------------------------------------------------------
    {
      id: 'crime_rate',
      name: 'Crime Rate',
      icon: '🔒',
      value: 0.3,
      prevValue: 0.3,
      defaultValue: 0.3,
      displayFormat: 'index',
      displayMin: 0,
      displayMax: 100,
      isGood: false,
      effects: [
        {
          targetId: 'consumer_confidence',
          multiplier: -0.2,
          formula: 'linear',
          delay: 0,
          inertia: 0.4,
        },
        {
          targetId: 'housing_affordability',
          multiplier: -0.1,
          formula: 'sqrt',
          delay: 0,
          inertia: 0.5,
        },
      ],
    },

    // --------------------------------------------------------
    // 6. Healthcare Quality
    // --------------------------------------------------------
    {
      id: 'health_quality',
      name: 'Healthcare Quality',
      icon: '🏥',
      value: 0.6,
      prevValue: 0.6,
      defaultValue: 0.6,
      displayFormat: 'index',
      displayMin: 0,
      displayMax: 100,
      isGood: true,
      effects: [
        {
          targetId: 'consumer_confidence',
          multiplier: 0.15,
          formula: 'linear',
          delay: 0,
          inertia: 0.4,
        },
        {
          targetId: 'poverty_rate',
          multiplier: -0.05,
          formula: 'linear',
          delay: 0,
          inertia: 0.6,
        },
      ],
    },

    // --------------------------------------------------------
    // 7. Education Quality
    // --------------------------------------------------------
    {
      id: 'education_quality',
      name: 'Education Quality',
      icon: '🎓',
      value: 0.6,
      prevValue: 0.6,
      defaultValue: 0.6,
      displayFormat: 'index',
      displayMin: 0,
      displayMax: 100,
      isGood: true,
      effects: [
        {
          targetId: 'technology_level',
          multiplier: 0.2,
          formula: 'linear',
          delay: 2,
          inertia: 0.7,
        },
        {
          targetId: 'crime_rate',
          multiplier: -0.1,
          formula: 'sqrt',
          delay: 3,
          inertia: 0.7,
        },
      ],
    },

    // --------------------------------------------------------
    // 8. Environment Quality
    // --------------------------------------------------------
    {
      id: 'environment_quality',
      name: 'Environment Quality',
      icon: '🌿',
      value: 0.55,
      prevValue: 0.55,
      defaultValue: 0.55,
      displayFormat: 'index',
      displayMin: 0,
      displayMax: 100,
      isGood: true,
      effects: [
        {
          targetId: 'health_quality',
          multiplier: 0.1,
          formula: 'linear',
          delay: 0,
          inertia: 0.5,
        },
        {
          targetId: 'housing_affordability',
          multiplier: 0.05,
          formula: 'sqrt',
          delay: 0,
          inertia: 0.5,
        },
      ],
    },

    // --------------------------------------------------------
    // 9. Technology & Innovation
    // --------------------------------------------------------
    {
      id: 'technology_level',
      name: 'Technology & Innovation',
      icon: '💻',
      value: 0.55,
      prevValue: 0.55,
      defaultValue: 0.55,
      displayFormat: 'index',
      displayMin: 0,
      displayMax: 100,
      isGood: true,
      effects: [
        {
          targetId: 'gdp_growth',
          multiplier: 0.15,
          formula: 'linear',
          delay: 0,
          inertia: 0.5,
        },
        {
          targetId: 'unemployment',
          multiplier: -0.1,
          formula: 'linear',
          delay: 1,
          inertia: 0.6,
        },
      ],
    },

    // --------------------------------------------------------
    // 10. Social Equality
    // --------------------------------------------------------
    {
      id: 'equality',
      name: 'Social Equality',
      icon: '⚖️',
      value: 0.45,
      prevValue: 0.45,
      defaultValue: 0.45,
      displayFormat: 'index',
      displayMin: 0,
      displayMax: 100,
      isGood: true,
      effects: [
        {
          targetId: 'crime_rate',
          multiplier: -0.15,
          formula: 'sqrt',
          delay: 0,
          inertia: 0.5,
        },
        {
          targetId: 'consumer_confidence',
          multiplier: 0.1,
          formula: 'linear',
          delay: 0,
          inertia: 0.4,
        },
      ],
    },

    // --------------------------------------------------------
    // 11. International Relations
    // --------------------------------------------------------
    {
      id: 'international_relations',
      name: 'International Relations',
      icon: '🌏',
      value: 0.6,
      prevValue: 0.6,
      defaultValue: 0.6,
      displayFormat: 'index',
      displayMin: 0,
      displayMax: 100,
      isGood: true,
      effects: [
        {
          targetId: 'gdp_growth',
          multiplier: 0.1,
          formula: 'linear',
          delay: 0,
          inertia: 0.5,
        },
        {
          targetId: 'technology_level',
          multiplier: 0.05,
          formula: 'sqrt',
          delay: 0,
          inertia: 0.6,
        },
      ],
    },

    // --------------------------------------------------------
    // 12. Infrastructure Quality
    // --------------------------------------------------------
    {
      id: 'infrastructure_quality',
      name: 'Infrastructure Quality',
      icon: '🏗️',
      value: 0.5,
      prevValue: 0.5,
      defaultValue: 0.5,
      displayFormat: 'index',
      displayMin: 0,
      displayMax: 100,
      isGood: true,
      effects: [
        {
          targetId: 'gdp_growth',
          multiplier: 0.1,
          formula: 'linear',
          delay: 0,
          inertia: 0.6,
        },
        {
          targetId: 'unemployment',
          multiplier: -0.05,
          formula: 'sqrt',
          delay: 0,
          inertia: 0.5,
        },
      ],
    },

    // --------------------------------------------------------
    // 13. Housing Affordability
    // --------------------------------------------------------
    {
      id: 'housing_affordability',
      name: 'Housing Affordability',
      icon: '🏠',
      value: 0.35,
      prevValue: 0.35,
      defaultValue: 0.35,
      displayFormat: 'index',
      displayMin: 0,
      displayMax: 100,
      isGood: true,
      effects: [
        {
          targetId: 'poverty_rate',
          multiplier: -0.1,
          formula: 'linear',
          delay: 0,
          inertia: 0.5,
        },
        {
          targetId: 'consumer_confidence',
          multiplier: 0.15,
          formula: 'linear',
          delay: 0,
          inertia: 0.4,
        },
      ],
    },

    // --------------------------------------------------------
    // 14. Consumer Confidence
    // --------------------------------------------------------
    {
      id: 'consumer_confidence',
      name: 'Consumer Confidence',
      icon: '🛒',
      value: 0.55,
      prevValue: 0.55,
      defaultValue: 0.55,
      displayFormat: 'index',
      displayMin: 0,
      displayMax: 100,
      isGood: true,
      effects: [
        {
          targetId: 'gdp_growth',
          multiplier: 0.2,
          formula: 'linear',
          delay: 0,
          inertia: 0.3,
        },
        {
          targetId: 'housing_affordability',
          multiplier: 0.05,
          formula: 'sqrt',
          delay: 0,
          inertia: 0.5,
        },
      ],
    },

    // --------------------------------------------------------
    // 15. Poverty Rate
    // --------------------------------------------------------
    {
      id: 'poverty_rate',
      name: 'Poverty Rate',
      icon: '📉',
      value: 0.3,
      prevValue: 0.3,
      defaultValue: 0.3,
      displayFormat: 'rate',
      displayMin: 0,
      displayMax: 40,
      isGood: false,
      effects: [
        {
          targetId: 'crime_rate',
          multiplier: 0.2,
          formula: 'linear',
          delay: 0,
          inertia: 0.4,
        },
        {
          targetId: 'health_quality',
          multiplier: -0.1,
          formula: 'sqrt',
          delay: 0,
          inertia: 0.5,
        },
        {
          targetId: 'education_quality',
          multiplier: -0.1,
          formula: 'linear',
          delay: 0,
          inertia: 0.6,
        },
      ],
    },
  ];
}
