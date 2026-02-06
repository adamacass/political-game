import { Bill, Issue, IdeologyStance } from '../types';

/**
 * All bill definitions for The House.
 *
 * Each bill is modelled on a real Australian policy debate.
 * Stance tables reflect realistic ideological positions:
 *   progressive / conservative  (social axis)
 *   market / interventionist    (economic axis)
 *
 * budgetImpact  : negative = costs the government money, positive = raises revenue
 * approvalImpact: how passing the bill shifts proposer approval
 * pCapReward    : political capital earned by the proposer when the bill passes
 * isLandmark    : landmark reforms are bigger, riskier, and worth more pCap
 */

const BILLS: Bill[] = [
  // ============================================================
  // ECONOMY
  // ============================================================
  {
    id: 'bill_stage3_tax_cuts',
    name: 'Stage 3 Income Tax Cuts',
    shortName: 'Stage 3 Tax Cuts',
    description:
      'Flatten the personal income tax brackets, delivering the largest benefits to high-income earners while simplifying the tax system.',
    issue: 'economy',
    stanceTable: {
      progressive: 'opposed',
      conservative: 'favoured',
      market: 'favoured',
      interventionist: 'opposed',
    },
    budgetImpact: -18,
    approvalImpact: 3,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_corporate_tax_reform',
    name: 'Corporate Tax Reform Act',
    shortName: 'Corporate Tax Reform',
    description:
      'Lower the corporate tax rate from 30% to 25% for all businesses, aiming to attract foreign investment and boost competitiveness.',
    issue: 'economy',
    stanceTable: {
      progressive: 'opposed',
      conservative: 'favoured',
      market: 'favoured',
      interventionist: 'opposed',
    },
    budgetImpact: -15,
    approvalImpact: -2,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_industrial_relations',
    name: 'Fair Work Amendment Bill',
    shortName: 'Fair Work Amendment',
    description:
      'Strengthen collective bargaining rights, increase penalty rates, and close loopholes in casual employment contracts.',
    issue: 'economy',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'opposed',
      market: 'opposed',
      interventionist: 'favoured',
    },
    budgetImpact: -3,
    approvalImpact: 5,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_superannuation_increase',
    name: 'Superannuation Guarantee Increase',
    shortName: 'Super Increase',
    description:
      'Raise the compulsory superannuation guarantee from 11.5% to 15%, securing retirement incomes at the cost of take-home pay.',
    issue: 'economy',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'neutral',
      market: 'opposed',
      interventionist: 'favoured',
    },
    budgetImpact: -5,
    approvalImpact: 2,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_mining_tax',
    name: 'Minerals Resource Rent Tax',
    shortName: 'Mining Tax',
    description:
      'Impose a super-profits tax on mining companies to capture a fairer share of resource wealth for the public.',
    issue: 'economy',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'opposed',
      market: 'opposed',
      interventionist: 'favoured',
    },
    budgetImpact: 15,
    approvalImpact: -3,
    pCapReward: 3,
    isLandmark: true,
  },

  // ============================================================
  // HEALTH
  // ============================================================
  {
    id: 'bill_ndis_expansion',
    name: 'NDIS Sustainability and Expansion Act',
    shortName: 'NDIS Expansion',
    description:
      'Expand eligibility and services under the National Disability Insurance Scheme while introducing new cost-control measures.',
    issue: 'health',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'neutral',
      market: 'opposed',
      interventionist: 'favoured',
    },
    budgetImpact: -20,
    approvalImpact: 7,
    pCapReward: 3,
    isLandmark: true,
  },
  {
    id: 'bill_medicare_levy',
    name: 'Medicare Levy Surcharge Reform',
    shortName: 'Medicare Levy Reform',
    description:
      'Increase the Medicare levy by 0.5% to fund expanded bulk-billing incentives and reduce out-of-pocket costs for patients.',
    issue: 'health',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'opposed',
      market: 'opposed',
      interventionist: 'favoured',
    },
    budgetImpact: 10,
    approvalImpact: 4,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_mental_health',
    name: 'National Mental Health Strategy',
    shortName: 'Mental Health Strategy',
    description:
      'Establish a national framework for mental health services, including crisis intervention teams and youth support programs.',
    issue: 'health',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'neutral',
      market: 'neutral',
      interventionist: 'favoured',
    },
    budgetImpact: -12,
    approvalImpact: 6,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_private_health_incentive',
    name: 'Private Health Insurance Incentive Act',
    shortName: 'Private Health Incentive',
    description:
      'Increase the private health insurance rebate and introduce tax penalties for those without cover, reducing pressure on public hospitals.',
    issue: 'health',
    stanceTable: {
      progressive: 'opposed',
      conservative: 'favoured',
      market: 'favoured',
      interventionist: 'opposed',
    },
    budgetImpact: -8,
    approvalImpact: -1,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_aged_care_reform',
    name: 'Royal Commission Aged Care Reform',
    shortName: 'Aged Care Reform',
    description:
      'Implement sweeping aged care reforms including mandatory staffing ratios, wage increases for carers, and a new quality regulator.',
    issue: 'health',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'neutral',
      market: 'opposed',
      interventionist: 'favoured',
    },
    budgetImpact: -14,
    approvalImpact: 8,
    pCapReward: 4,
    isLandmark: true,
  },

  // ============================================================
  // HOUSING
  // ============================================================
  {
    id: 'bill_haff',
    name: 'Housing Australia Future Fund',
    shortName: 'Housing Future Fund',
    description:
      'Establish a $10 billion investment fund to finance 30,000 new social and affordable housing dwellings over five years.',
    issue: 'housing',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'neutral',
      market: 'neutral',
      interventionist: 'favoured',
    },
    budgetImpact: -16,
    approvalImpact: 6,
    pCapReward: 3,
    isLandmark: true,
  },
  {
    id: 'bill_negative_gearing',
    name: 'Negative Gearing Reform Bill',
    shortName: 'Negative Gearing Reform',
    description:
      'Restrict negative gearing to new housing only and halve the capital gains tax discount, aiming to improve affordability for first-home buyers.',
    issue: 'housing',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'opposed',
      market: 'opposed',
      interventionist: 'favoured',
    },
    budgetImpact: 12,
    approvalImpact: -4,
    pCapReward: 3,
    isLandmark: true,
  },
  {
    id: 'bill_first_home_guarantee',
    name: 'First Home Buyer Guarantee Expansion',
    shortName: 'First Home Guarantee',
    description:
      'Expand the government-backed low-deposit scheme to allow more first-home buyers to enter the market with as little as 5% deposit.',
    issue: 'housing',
    stanceTable: {
      progressive: 'neutral',
      conservative: 'favoured',
      market: 'favoured',
      interventionist: 'neutral',
    },
    budgetImpact: -6,
    approvalImpact: 5,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_rent_controls',
    name: 'National Rent Stabilisation Act',
    shortName: 'Rent Controls',
    description:
      'Cap annual rent increases at CPI plus 2% and establish a national rental ombudsman to protect tenants from excessive hikes.',
    issue: 'housing',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'opposed',
      market: 'opposed',
      interventionist: 'favoured',
    },
    budgetImpact: -2,
    approvalImpact: 4,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_foreign_investment_housing',
    name: 'Foreign Investment in Housing Restriction',
    shortName: 'Foreign Buyer Ban',
    description:
      'Ban foreign non-residents from purchasing existing residential property and increase surcharges on vacant foreign-owned dwellings.',
    issue: 'housing',
    stanceTable: {
      progressive: 'neutral',
      conservative: 'favoured',
      market: 'opposed',
      interventionist: 'favoured',
    },
    budgetImpact: 2,
    approvalImpact: 5,
    pCapReward: 2,
    isLandmark: false,
  },

  // ============================================================
  // CLIMATE
  // ============================================================
  {
    id: 'bill_emissions_trading',
    name: 'Emissions Trading Scheme',
    shortName: 'Emissions Trading',
    description:
      'Establish a national cap-and-trade system for carbon emissions, setting a declining cap on total greenhouse gases and allowing companies to trade permits.',
    issue: 'climate',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'opposed',
      market: 'neutral',
      interventionist: 'favoured',
    },
    budgetImpact: 8,
    approvalImpact: -2,
    pCapReward: 4,
    isLandmark: true,
  },
  {
    id: 'bill_nuclear_ban_repeal',
    name: 'Nuclear Energy Ban Repeal',
    shortName: 'Nuclear Ban Repeal',
    description:
      'Repeal the moratorium on nuclear power generation in Australia, allowing the construction of small modular reactors to provide baseload energy.',
    issue: 'climate',
    stanceTable: {
      progressive: 'opposed',
      conservative: 'favoured',
      market: 'favoured',
      interventionist: 'neutral',
    },
    budgetImpact: -10,
    approvalImpact: -5,
    pCapReward: 3,
    isLandmark: true,
  },
  {
    id: 'bill_renewable_target',
    name: 'Renewable Energy Target Extension',
    shortName: 'Renewable Target',
    description:
      'Set a mandatory target of 82% renewable electricity generation by 2030, backed by investment tax credits for wind, solar, and storage.',
    issue: 'climate',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'opposed',
      market: 'neutral',
      interventionist: 'favoured',
    },
    budgetImpact: -12,
    approvalImpact: 3,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_gas_led_recovery',
    name: 'Gas-Led Economic Recovery Act',
    shortName: 'Gas-Led Recovery',
    description:
      'Subsidise new gas extraction and processing projects as a transitional energy source, including pipeline infrastructure in regional areas.',
    issue: 'climate',
    stanceTable: {
      progressive: 'opposed',
      conservative: 'favoured',
      market: 'favoured',
      interventionist: 'neutral',
    },
    budgetImpact: -7,
    approvalImpact: -3,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_electric_vehicle',
    name: 'Electric Vehicle Transition Package',
    shortName: 'EV Transition',
    description:
      'Introduce fuel efficiency standards, remove the fringe benefits tax on EVs, and fund a national charging network to accelerate the transition.',
    issue: 'climate',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'neutral',
      market: 'neutral',
      interventionist: 'favoured',
    },
    budgetImpact: -9,
    approvalImpact: 4,
    pCapReward: 2,
    isLandmark: false,
  },

  // ============================================================
  // SECURITY
  // ============================================================
  {
    id: 'bill_aukus',
    name: 'AUKUS Submarine Acquisition Act',
    shortName: 'AUKUS Submarines',
    description:
      'Authorise the $368 billion acquisition of nuclear-powered submarines under the AUKUS agreement with the United States and United Kingdom.',
    issue: 'security',
    stanceTable: {
      progressive: 'opposed',
      conservative: 'favoured',
      market: 'neutral',
      interventionist: 'favoured',
    },
    budgetImpact: -20,
    approvalImpact: 2,
    pCapReward: 4,
    isLandmark: true,
  },
  {
    id: 'bill_cyber_security',
    name: 'Critical Infrastructure Cyber Security Act',
    shortName: 'Cyber Security Act',
    description:
      'Mandate minimum cyber security standards for critical infrastructure operators and establish a national cyber incident response team.',
    issue: 'security',
    stanceTable: {
      progressive: 'neutral',
      conservative: 'favoured',
      market: 'neutral',
      interventionist: 'favoured',
    },
    budgetImpact: -5,
    approvalImpact: 3,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_border_protection',
    name: 'Maritime Border Protection Enhancement',
    shortName: 'Border Protection',
    description:
      'Increase funding for maritime surveillance, expand offshore processing capacity, and streamline deportation procedures.',
    issue: 'security',
    stanceTable: {
      progressive: 'opposed',
      conservative: 'favoured',
      market: 'neutral',
      interventionist: 'neutral',
    },
    budgetImpact: -8,
    approvalImpact: -2,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_counter_terrorism',
    name: 'Counter-Terrorism Legislation Amendment',
    shortName: 'Counter-Terrorism',
    description:
      'Expand police powers for preventive detention and surveillance of suspected terrorists, with enhanced judicial oversight provisions.',
    issue: 'security',
    stanceTable: {
      progressive: 'opposed',
      conservative: 'favoured',
      market: 'opposed',
      interventionist: 'favoured',
    },
    budgetImpact: -6,
    approvalImpact: 1,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_defence_industry',
    name: 'Sovereign Defence Industry Investment',
    shortName: 'Defence Industry',
    description:
      'Establish a sovereign defence manufacturing capability, investing in domestic production of munitions, armoured vehicles, and drone technology.',
    issue: 'security',
    stanceTable: {
      progressive: 'neutral',
      conservative: 'favoured',
      market: 'neutral',
      interventionist: 'favoured',
    },
    budgetImpact: -15,
    approvalImpact: 3,
    pCapReward: 3,
    isLandmark: true,
  },

  // ============================================================
  // EDUCATION
  // ============================================================
  {
    id: 'bill_student_debt_relief',
    name: 'HECS-HELP Debt Relief Act',
    shortName: 'Student Debt Relief',
    description:
      'Wipe accumulated HECS indexation above CPI, cap future indexation at the lower of CPI or wage growth, and reduce outstanding balances.',
    issue: 'education',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'opposed',
      market: 'opposed',
      interventionist: 'favoured',
    },
    budgetImpact: -13,
    approvalImpact: 7,
    pCapReward: 3,
    isLandmark: true,
  },
  {
    id: 'bill_gonski_funding',
    name: 'Gonski Needs-Based School Funding',
    shortName: 'Gonski Funding',
    description:
      'Fully implement needs-based school funding, directing resources to disadvantaged schools regardless of the government or non-government sector.',
    issue: 'education',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'neutral',
      market: 'opposed',
      interventionist: 'favoured',
    },
    budgetImpact: -14,
    approvalImpact: 6,
    pCapReward: 3,
    isLandmark: true,
  },
  {
    id: 'bill_university_deregulation',
    name: 'University Fee Deregulation Bill',
    shortName: 'Uni Deregulation',
    description:
      'Allow universities to set their own tuition fees while expanding the income-contingent loan scheme and creating a demand-driven funding model.',
    issue: 'education',
    stanceTable: {
      progressive: 'opposed',
      conservative: 'favoured',
      market: 'favoured',
      interventionist: 'opposed',
    },
    budgetImpact: 5,
    approvalImpact: -6,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_tafe_investment',
    name: 'Fee-Free TAFE Expansion',
    shortName: 'Fee-Free TAFE',
    description:
      'Permanently fund fee-free TAFE places in priority skill areas including nursing, construction, IT, and early childhood education.',
    issue: 'education',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'neutral',
      market: 'neutral',
      interventionist: 'favoured',
    },
    budgetImpact: -10,
    approvalImpact: 5,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_indigenous_education',
    name: 'Closing the Gap Education Package',
    shortName: 'Closing the Gap',
    description:
      'Fund remote and Indigenous community schools, establish cultural curriculum frameworks, and create 5,000 Indigenous teacher scholarships.',
    issue: 'education',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'neutral',
      market: 'neutral',
      interventionist: 'favoured',
    },
    budgetImpact: -8,
    approvalImpact: 4,
    pCapReward: 2,
    isLandmark: false,
  },

  // ============================================================
  // CROSS-CUTTING / ADDITIONAL BILLS
  // ============================================================
  {
    id: 'bill_voice_to_parliament',
    name: 'Indigenous Voice to Parliament',
    shortName: 'Voice to Parliament',
    description:
      'Establish a constitutionally enshrined advisory body to give Aboriginal and Torres Strait Islander peoples a voice on policies affecting their communities.',
    issue: 'education',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'opposed',
      market: 'neutral',
      interventionist: 'neutral',
    },
    budgetImpact: -3,
    approvalImpact: -5,
    pCapReward: 4,
    isLandmark: true,
  },
  {
    id: 'bill_federal_icac',
    name: 'National Anti-Corruption Commission Act',
    shortName: 'Federal ICAC',
    description:
      'Establish a powerful, independent national anti-corruption commission with the authority to hold public hearings and investigate all federal officials.',
    issue: 'security',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'neutral',
      market: 'neutral',
      interventionist: 'favoured',
    },
    budgetImpact: -4,
    approvalImpact: 8,
    pCapReward: 3,
    isLandmark: true,
  },
  {
    id: 'bill_media_bargaining',
    name: 'News Media Bargaining Code',
    shortName: 'Media Bargaining Code',
    description:
      'Force digital platforms to negotiate payment for Australian news content and establish an arbitration mechanism for disputes.',
    issue: 'economy',
    stanceTable: {
      progressive: 'neutral',
      conservative: 'neutral',
      market: 'opposed',
      interventionist: 'favoured',
    },
    budgetImpact: 0,
    approvalImpact: 2,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_childcare_subsidy',
    name: 'Universal Childcare Subsidy Act',
    shortName: 'Childcare Subsidy',
    description:
      'Increase the childcare subsidy to 90% for families earning under $80,000 and remove the annual cap, making early education accessible to all.',
    issue: 'education',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'neutral',
      market: 'opposed',
      interventionist: 'favoured',
    },
    budgetImpact: -11,
    approvalImpact: 7,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_water_management',
    name: 'Murray-Darling Basin Water Recovery',
    shortName: 'Murray-Darling Plan',
    description:
      'Commit to recovering 450 gigalitres of environmental water through infrastructure upgrades and voluntary buybacks from irrigators.',
    issue: 'climate',
    stanceTable: {
      progressive: 'favoured',
      conservative: 'opposed',
      market: 'neutral',
      interventionist: 'favoured',
    },
    budgetImpact: -7,
    approvalImpact: 1,
    pCapReward: 2,
    isLandmark: false,
  },
  {
    id: 'bill_gst_reform',
    name: 'GST Distribution Reform',
    shortName: 'GST Reform',
    description:
      'Overhaul the Goods and Services Tax distribution formula to ensure no state is worse off while incentivising economic reform.',
    issue: 'economy',
    stanceTable: {
      progressive: 'neutral',
      conservative: 'favoured',
      market: 'favoured',
      interventionist: 'neutral',
    },
    budgetImpact: 0,
    approvalImpact: 1,
    pCapReward: 2,
    isLandmark: false,
  },
];

/**
 * Return a copy of all bill definitions.
 */
export function getAllBills(): Bill[] {
  return BILLS.map(bill => ({ ...bill, stanceTable: { ...bill.stanceTable } }));
}
