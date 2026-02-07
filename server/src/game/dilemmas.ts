import { DilemmaDefinition, DilemmaChoice } from '../types';

export function getAllDilemmas(): DilemmaDefinition[] {
  return [
    // ================================================================
    // 1. MINING VS REEF
    // ================================================================
    {
      id: 'mining_vs_reef',
      name: 'Mining Near the Great Barrier Reef',
      headline: 'Mining Company Seeks Approval Near Great Barrier Reef',
      description:
        'A major mining conglomerate has applied for exploration rights in a coastal zone adjacent to the Great Barrier Reef World Heritage Area. The proposed mine would extract rare earth minerals critical for battery manufacturing. Environmental scientists warn of potential runoff contamination and sediment disruption to fragile coral ecosystems. The company promises 3,000 direct jobs in regional Queensland and significant royalty payments to the federal government.',
      icon: '🪸',
      choices: [
        {
          id: 'approve_mining',
          label: 'Approve the Mining Licence',
          description:
            'Grant full exploration and extraction rights. The economic benefits are too significant to ignore, especially for regional employment.',
          effects: [
            { nodeId: 'gdp_growth', delta: 0.12, duration: 3 },
            { nodeId: 'unemployment', delta: -0.08, duration: 3 },
            { nodeId: 'environment_quality', delta: -0.15, duration: 4 },
          ],
          voterReactions: [
            { groupId: 'business_owners', delta: 0.25 },
            { groupId: 'workers', delta: 0.15 },
            { groupId: 'environmentalists', delta: -0.3 },
          ],
        },
        {
          id: 'block_mining',
          label: 'Block the Application',
          description:
            'Reject the mining licence outright. The reef is an irreplaceable natural wonder and UNESCO World Heritage site that must be protected at all costs.',
          effects: [
            { nodeId: 'environment_quality', delta: 0.1, duration: 2 },
            { nodeId: 'gdp_growth', delta: -0.06, duration: 2 },
            { nodeId: 'international_relations', delta: 0.05, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'environmentalists', delta: 0.25 },
            { groupId: 'business_owners', delta: -0.2 },
            { groupId: 'workers', delta: -0.1 },
          ],
        },
      ],
      oneShot: true,
    },

    // ================================================================
    // 2. PANDEMIC RESPONSE
    // ================================================================
    {
      id: 'pandemic_response',
      name: 'Disease Outbreak Response',
      headline: 'New Disease Outbreak Detected',
      description:
        'Health authorities have identified a novel respiratory virus spreading rapidly through major population centres. Early modelling suggests hospitals could be overwhelmed within weeks without intervention. The business community is already voicing concerns about any measures that could disrupt trade and commerce. State premiers are divided, and the public is anxious.',
      icon: '🦠',
      choices: [
        {
          id: 'strict_lockdown',
          label: 'Impose Strict Lockdown',
          description:
            'Mandate stay-at-home orders, close non-essential businesses, and restrict interstate travel. Maximum protection for the health system at severe economic cost.',
          effects: [
            { nodeId: 'health_quality', delta: 0.15, duration: 2 },
            { nodeId: 'gdp_growth', delta: -0.18, duration: 3 },
            { nodeId: 'unemployment', delta: 0.12, duration: 3 },
            { nodeId: 'crime_rate', delta: 0.05, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'healthcare_workers', delta: 0.2 },
            { groupId: 'retirees', delta: 0.15 },
            { groupId: 'business_owners', delta: -0.25 },
          ],
        },
        {
          id: 'moderate_measures',
          label: 'Targeted Moderate Measures',
          description:
            'Implement mask mandates, capacity limits, and enhanced testing without full lockdowns. Try to balance health outcomes with economic activity.',
          effects: [
            { nodeId: 'health_quality', delta: 0.08, duration: 2 },
            { nodeId: 'gdp_growth', delta: -0.07, duration: 2 },
            { nodeId: 'consumer_confidence', delta: -0.05, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'healthcare_workers', delta: 0.05 },
            { groupId: 'business_owners', delta: -0.08 },
            { groupId: 'parents', delta: 0.1 },
          ],
        },
        {
          id: 'minimal_response',
          label: 'Minimal Intervention',
          description:
            'Issue health advisories and boost hospital capacity but impose no restrictions on business or movement. Trust individuals to make their own choices.',
          effects: [
            { nodeId: 'health_quality', delta: -0.12, duration: 3 },
            { nodeId: 'gdp_growth', delta: 0.04, duration: 2 },
            { nodeId: 'poverty_rate', delta: 0.06, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'business_owners', delta: 0.15 },
            { groupId: 'healthcare_workers', delta: -0.25 },
            { groupId: 'retirees', delta: -0.2 },
          ],
        },
      ],
      condition: { nodeId: 'health_quality', operator: '<', value: 0.4 },
      oneShot: false,
    },

    // ================================================================
    // 3. TECH GIANT TAX
    // ================================================================
    {
      id: 'tech_giant_tax',
      name: 'Tech Giant Tax Avoidance',
      headline: 'Global Tech Companies Avoiding Australian Tax',
      description:
        'An ATO investigation has revealed that the five largest global technology companies operating in Australia collectively paid less than $80 million in tax on estimated revenues exceeding $12 billion. Public outrage is growing as ordinary Australians struggle with rising costs while multinational giants exploit complex corporate structures to minimise their obligations. The tech industry warns that punitive taxation will drive investment offshore.',
      icon: '💻',
      choices: [
        {
          id: 'digital_tax',
          label: 'Introduce a Digital Services Tax',
          description:
            'Impose a 3% levy on all digital revenue earned in Australia by companies with global revenue exceeding $1 billion. Send a clear message that Australia will not tolerate profit-shifting.',
          effects: [
            { nodeId: 'public_debt', delta: -0.1, duration: 3 },
            { nodeId: 'technology_level', delta: -0.06, duration: 3 },
            { nodeId: 'equality', delta: 0.08, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'workers', delta: 0.2 },
            { groupId: 'tech_workers', delta: -0.2 },
            { groupId: 'business_owners', delta: -0.15 },
          ],
        },
        {
          id: 'negotiate_contributions',
          label: 'Negotiate Voluntary Contributions',
          description:
            'Work with tech companies behind closed doors to secure voluntary tax agreements and investment commitments in Australian infrastructure and education. Avoids confrontation but may appear weak.',
          effects: [
            { nodeId: 'public_debt', delta: -0.04, duration: 2 },
            { nodeId: 'technology_level', delta: 0.04, duration: 2 },
            { nodeId: 'international_relations', delta: 0.03, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'workers', delta: -0.05 },
            { groupId: 'tech_workers', delta: 0.1 },
            { groupId: 'business_owners', delta: 0.05 },
          ],
        },
        {
          id: 'maintain_status_quo',
          label: 'Maintain the Status Quo',
          description:
            'Australia should wait for the OECD global minimum tax framework rather than acting unilaterally. Going alone risks retaliation and capital flight.',
          effects: [
            { nodeId: 'technology_level', delta: 0.05, duration: 2 },
            { nodeId: 'equality', delta: -0.04, duration: 2 },
            { nodeId: 'international_relations', delta: 0.04, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'business_owners', delta: 0.15 },
            { groupId: 'tech_workers', delta: 0.1 },
            { groupId: 'workers', delta: -0.15 },
          ],
        },
      ],
      oneShot: true,
    },

    // ================================================================
    // 4. REFUGEE BOAT
    // ================================================================
    {
      id: 'refugee_boat',
      name: 'Asylum Seekers at Sea',
      headline: 'Asylum Seekers Intercepted at Sea',
      description:
        'A vessel carrying 87 asylum seekers, including 23 children, has been intercepted by the Australian Border Force in waters north of Christmas Island. Intelligence reports suggest the passengers fled persecution in their home country. The opposition is already framing this as a test of border security, while human rights organisations are demanding the passengers be brought ashore for processing. Whatever you decide will set a precedent.',
      icon: '🚢',
      choices: [
        {
          id: 'accept_refugees',
          label: 'Bring Ashore for Processing',
          description:
            'Transfer all asylum seekers to the Australian mainland for standard refugee assessment. Uphold our humanitarian obligations under international law.',
          effects: [
            { nodeId: 'international_relations', delta: 0.1, duration: 2 },
            { nodeId: 'public_debt', delta: 0.04, duration: 2 },
            { nodeId: 'equality', delta: 0.06, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'immigrants', delta: 0.25 },
            { groupId: 'students', delta: 0.1 },
            { groupId: 'religious', delta: -0.15 },
          ],
        },
        {
          id: 'offshore_processing',
          label: 'Send to Offshore Processing',
          description:
            'Transfer the asylum seekers to an offshore processing facility for assessment. Maintains border policy while still providing a pathway for legitimate refugees.',
          effects: [
            { nodeId: 'public_debt', delta: 0.06, duration: 3 },
            { nodeId: 'international_relations', delta: -0.05, duration: 2 },
            { nodeId: 'crime_rate', delta: -0.02, duration: 1 },
          ],
          voterReactions: [
            { groupId: 'immigrants', delta: -0.1 },
            { groupId: 'religious', delta: 0.05 },
            { groupId: 'workers', delta: 0.05 },
          ],
        },
        {
          id: 'turn_back',
          label: 'Turn the Boats Back',
          description:
            'Order the Border Force to safely return the vessel to international waters. Send an unequivocal signal that unauthorised maritime arrivals will not be tolerated.',
          effects: [
            { nodeId: 'international_relations', delta: -0.12, duration: 2 },
            { nodeId: 'equality', delta: -0.06, duration: 2 },
            { nodeId: 'public_debt', delta: -0.02, duration: 1 },
          ],
          voterReactions: [
            { groupId: 'immigrants', delta: -0.3 },
            { groupId: 'religious', delta: 0.12 },
            { groupId: 'motorists', delta: 0.08 },
          ],
        },
      ],
      oneShot: false,
    },

    // ================================================================
    // 5. DROUGHT RESPONSE
    // ================================================================
    {
      id: 'drought_response',
      name: 'Eastern States Drought',
      headline: 'Severe Drought Hits Eastern States',
      description:
        'The Bureau of Meteorology has declared the worst drought conditions in forty years across New South Wales, Queensland, and parts of Victoria. Crop yields are projected to fall by 40%, livestock losses are mounting, and several regional towns face imminent water supply failure. Farmers are demanding immediate relief, but the treasury is already under strain. Experts say this drought could last another two years.',
      icon: '🏜️',
      choices: [
        {
          id: 'emergency_infrastructure',
          label: 'Emergency Water Infrastructure',
          description:
            'Commit $6 billion to emergency desalination plants, pipeline extensions, and bore water programs. Expensive but provides lasting drought resilience.',
          effects: [
            { nodeId: 'public_debt', delta: 0.14, duration: 4 },
            { nodeId: 'infrastructure_quality', delta: 0.12, duration: 4 },
            { nodeId: 'environment_quality', delta: 0.06, duration: 3 },
          ],
          voterReactions: [
            { groupId: 'farmers', delta: 0.25 },
            { groupId: 'workers', delta: 0.1 },
            { groupId: 'wealthy', delta: -0.1 },
          ],
        },
        {
          id: 'water_restrictions',
          label: 'Impose Water Restrictions',
          description:
            'Implement strict water usage limits across all eastern states. Cheap for the government but deeply unpopular with households and businesses already suffering.',
          effects: [
            { nodeId: 'environment_quality', delta: 0.08, duration: 2 },
            { nodeId: 'consumer_confidence', delta: -0.1, duration: 2 },
            { nodeId: 'gdp_growth', delta: -0.05, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'farmers', delta: -0.15 },
            { groupId: 'motorists', delta: -0.1 },
            { groupId: 'environmentalists', delta: 0.15 },
          ],
        },
        {
          id: 'do_nothing_drought',
          label: 'Offer Thoughts and Prayers',
          description:
            'Provide modest financial assistance to the worst-affected communities but avoid major spending commitments. Hope the weather breaks soon.',
          effects: [
            { nodeId: 'environment_quality', delta: -0.08, duration: 3 },
            { nodeId: 'poverty_rate', delta: 0.08, duration: 3 },
            { nodeId: 'consumer_confidence', delta: -0.06, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'farmers', delta: -0.3 },
            { groupId: 'environmentalists', delta: -0.15 },
            { groupId: 'wealthy', delta: 0.05 },
          ],
        },
      ],
      condition: { nodeId: 'environment_quality', operator: '<', value: 0.35 },
      oneShot: false,
    },

    // ================================================================
    // 6. HOUSING DEVELOPER
    // ================================================================
    {
      id: 'housing_developer',
      name: 'Major Housing Development',
      headline: 'Major Housing Development Proposal',
      description:
        'A consortium of developers has proposed a 15,000-dwelling housing estate on the urban fringe of Sydney, promising to ease the chronic housing shortage. The site includes remnant bushland classified as endangered ecological community, home to several threatened species. Local councils are split. Housing advocates say the city desperately needs supply; conservationists say the cost is too high.',
      icon: '🏗️',
      choices: [
        {
          id: 'fast_track',
          label: 'Fast-Track the Development',
          description:
            'Override planning objections and approve the full development. Housing supply is a national emergency and we cannot afford delays.',
          effects: [
            { nodeId: 'housing_affordability', delta: 0.15, duration: 3 },
            { nodeId: 'environment_quality', delta: -0.1, duration: 4 },
            { nodeId: 'gdp_growth', delta: 0.06, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'parents', delta: 0.2 },
            { groupId: 'workers', delta: 0.1 },
            { groupId: 'environmentalists', delta: -0.25 },
          ],
        },
        {
          id: 'green_development',
          label: 'Approve with Green Conditions',
          description:
            'Approve a reduced development of 8,000 dwellings with mandatory green corridors, wildlife bridges, and renewable energy requirements. More expensive and slower, but tries to balance outcomes.',
          effects: [
            { nodeId: 'housing_affordability', delta: 0.08, duration: 4 },
            { nodeId: 'environment_quality', delta: -0.03, duration: 2 },
            { nodeId: 'public_debt', delta: 0.06, duration: 3 },
            { nodeId: 'infrastructure_quality', delta: 0.04, duration: 3 },
          ],
          voterReactions: [
            { groupId: 'parents', delta: 0.08 },
            { groupId: 'environmentalists', delta: -0.05 },
            { groupId: 'business_owners', delta: -0.08 },
          ],
        },
        {
          id: 'reject_development',
          label: 'Reject the Proposal',
          description:
            'Block the development entirely to protect the endangered ecological community. The housing crisis will need to be solved another way.',
          effects: [
            { nodeId: 'housing_affordability', delta: -0.08, duration: 3 },
            { nodeId: 'environment_quality', delta: 0.08, duration: 2 },
            { nodeId: 'consumer_confidence', delta: -0.05, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'environmentalists', delta: 0.25 },
            { groupId: 'parents', delta: -0.15 },
            { groupId: 'students', delta: -0.1 },
          ],
        },
      ],
      oneShot: true,
    },

    // ================================================================
    // 7. UNION STRIKE
    // ================================================================
    {
      id: 'union_strike',
      name: 'National Union Strike',
      headline: 'Major Union Threatens National Strike',
      description:
        'The Australian Council of Trade Unions has issued a 48-hour ultimatum demanding a 7% wage increase across the public sector and strengthened unfair dismissal protections. If their demands are not met, they will call a national strike affecting transport, healthcare, and education. Business groups warn that meeting the demands will fuel inflation and destroy productivity. Workers say wages have not kept pace with the cost of living for a decade.',
      icon: '✊',
      choices: [
        {
          id: 'negotiate_union',
          label: 'Negotiate and Concede',
          description:
            'Meet the union at the table and offer a 5% wage increase with phased implementation. Avoid a crippling strike at the cost of higher government expenditure.',
          effects: [
            { nodeId: 'public_debt', delta: 0.1, duration: 3 },
            { nodeId: 'inflation', delta: 0.06, duration: 2 },
            { nodeId: 'equality', delta: 0.08, duration: 3 },
            { nodeId: 'poverty_rate', delta: -0.06, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'workers', delta: 0.2 },
            { groupId: 'public_servants', delta: 0.25 },
            { groupId: 'business_owners', delta: -0.2 },
          ],
        },
        {
          id: 'legislate_back',
          label: 'Legislate Back to Work',
          description:
            'Introduce emergency legislation declaring the strike illegal and ordering workers back to their posts. A show of strength that risks long-term industrial relations damage.',
          effects: [
            { nodeId: 'gdp_growth', delta: 0.04, duration: 1 },
            { nodeId: 'equality', delta: -0.08, duration: 3 },
            { nodeId: 'crime_rate', delta: 0.04, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'workers', delta: -0.3 },
            { groupId: 'public_servants', delta: -0.25 },
            { groupId: 'business_owners', delta: 0.2 },
          ],
        },
        {
          id: 'mediate_strike',
          label: 'Appoint an Independent Mediator',
          description:
            'Refer the dispute to Fair Work Australia for binding arbitration. Neither side gets exactly what they want, and the process will take weeks, but the outcome carries legitimacy.',
          effects: [
            { nodeId: 'gdp_growth', delta: -0.04, duration: 2 },
            { nodeId: 'public_debt', delta: 0.04, duration: 2 },
            { nodeId: 'consumer_confidence', delta: -0.05, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'workers', delta: -0.05 },
            { groupId: 'public_servants', delta: -0.05 },
            { groupId: 'business_owners', delta: -0.05 },
          ],
        },
      ],
      oneShot: false,
    },

    // ================================================================
    // 8. CHINA TRADE
    // ================================================================
    {
      id: 'china_trade',
      name: 'China Trade Restrictions',
      headline: 'China Imposes Trade Restrictions',
      description:
        'In apparent retaliation for recent diplomatic statements, China has imposed punitive tariffs on Australian wine, barley, coal, and lobster exports. The measures affect billions of dollars in trade and threaten thousands of jobs in agriculture and mining. The foreign minister is urging caution; the trade minister wants to fight back. Australia\'s largest trading partner is flexing its economic muscle, and the world is watching how we respond.',
      icon: '📦',
      choices: [
        {
          id: 'diplomatic_engagement',
          label: 'Pursue Diplomatic Engagement',
          description:
            'Seek quiet diplomatic channels to de-escalate the situation. Avoid public confrontation and work through back-channels to restore trade relations over time.',
          effects: [
            { nodeId: 'international_relations', delta: 0.08, duration: 3 },
            { nodeId: 'gdp_growth', delta: -0.06, duration: 3 },
            { nodeId: 'unemployment', delta: 0.04, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'business_owners', delta: 0.05 },
            { groupId: 'farmers', delta: -0.1 },
            { groupId: 'workers', delta: -0.08 },
          ],
        },
        {
          id: 'retaliatory_tariffs',
          label: 'Impose Retaliatory Tariffs',
          description:
            'Hit back with equivalent tariffs on Chinese manufactured goods. Stand up for Australian sovereignty and refuse to be bullied by economic coercion.',
          effects: [
            { nodeId: 'international_relations', delta: -0.12, duration: 3 },
            { nodeId: 'inflation', delta: 0.08, duration: 2 },
            { nodeId: 'consumer_confidence', delta: -0.08, duration: 2 },
            { nodeId: 'gdp_growth', delta: -0.1, duration: 3 },
          ],
          voterReactions: [
            { groupId: 'business_owners', delta: -0.15 },
            { groupId: 'workers', delta: 0.1 },
            { groupId: 'farmers', delta: 0.05 },
          ],
        },
        {
          id: 'diversify_trade',
          label: 'Diversify Trade Partners',
          description:
            'Launch a major trade diversification strategy targeting India, Indonesia, and the EU. Expensive and slow to pay off, but reduces long-term vulnerability to any single trading partner.',
          effects: [
            { nodeId: 'public_debt', delta: 0.08, duration: 4 },
            { nodeId: 'international_relations', delta: 0.06, duration: 4 },
            { nodeId: 'gdp_growth', delta: -0.04, duration: 2 },
            { nodeId: 'gdp_growth', delta: 0.08, duration: 4 },
          ],
          voterReactions: [
            { groupId: 'business_owners', delta: 0.1 },
            { groupId: 'farmers', delta: 0.08 },
            { groupId: 'workers', delta: -0.05 },
          ],
        },
      ],
      oneShot: true,
    },

    // ================================================================
    // 9. INDIGENOUS LAND RIGHTS
    // ================================================================
    {
      id: 'indigenous_land_rights',
      name: 'Indigenous Land Rights Dispute',
      headline: 'Indigenous Land Rights Claim Over Mining Site',
      description:
        'Traditional owners have lodged a native title claim over a region in Western Australia that contains one of the world\'s largest undeveloped lithium deposits. The claim has strong anthropological evidence and broad community support among First Nations groups. However, the lithium is critical to Australia\'s ambitions in the clean energy supply chain and the mine would generate an estimated $4 billion in revenue over its lifetime. A landmark legal and moral decision awaits.',
      icon: '🪃',
      choices: [
        {
          id: 'recognize_claim',
          label: 'Recognise the Land Claim',
          description:
            'Uphold the traditional owners\' native title claim in full. Establish the site as protected indigenous land, forgoing the mining opportunity entirely.',
          effects: [
            { nodeId: 'equality', delta: 0.15, duration: 4 },
            { nodeId: 'gdp_growth', delta: -0.08, duration: 3 },
            { nodeId: 'international_relations', delta: 0.06, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'indigenous', delta: 0.3 },
            { groupId: 'students', delta: 0.1 },
            { groupId: 'business_owners', delta: -0.2 },
          ],
        },
        {
          id: 'compromise_land',
          label: 'Negotiate a Shared Benefit Agreement',
          description:
            'Broker a deal where mining proceeds on a reduced footprint, with traditional owners receiving royalty payments, employment guarantees, and heritage site protection within the lease area.',
          effects: [
            { nodeId: 'gdp_growth', delta: 0.05, duration: 3 },
            { nodeId: 'equality', delta: 0.06, duration: 3 },
            { nodeId: 'environment_quality', delta: -0.05, duration: 3 },
            { nodeId: 'public_debt', delta: -0.04, duration: 3 },
          ],
          voterReactions: [
            { groupId: 'indigenous', delta: 0.05 },
            { groupId: 'business_owners', delta: 0.05 },
            { groupId: 'workers', delta: 0.08 },
          ],
        },
        {
          id: 'reject_claim',
          label: 'Reject the Claim',
          description:
            'Overrule the native title claim on grounds of national economic interest. The lithium is too strategically important to leave in the ground.',
          effects: [
            { nodeId: 'gdp_growth', delta: 0.1, duration: 3 },
            { nodeId: 'equality', delta: -0.12, duration: 4 },
            { nodeId: 'international_relations', delta: -0.08, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'indigenous', delta: -0.3 },
            { groupId: 'business_owners', delta: 0.2 },
            { groupId: 'environmentalists', delta: -0.1 },
          ],
        },
      ],
      oneShot: true,
    },

    // ================================================================
    // 10. SOCIAL MEDIA REGULATION
    // ================================================================
    {
      id: 'social_media_regulation',
      name: 'Social Media Crisis',
      headline: 'Social Media Misinformation Spreading',
      description:
        'A surge of health misinformation and political disinformation on social media platforms has been linked to declining vaccination rates and a spike in conspiracy-driven protests. Parents are alarmed about the impact on children, while retirees are particularly vulnerable to scams and manipulation. The tech industry insists that heavy-handed regulation will stifle innovation and free speech. Civil liberties groups are divided.',
      icon: '📱',
      choices: [
        {
          id: 'heavy_regulation',
          label: 'Legislate Strict Platform Regulation',
          description:
            'Introduce mandatory content moderation standards, algorithmic transparency requirements, and age verification. Platforms face massive fines for non-compliance.',
          effects: [
            { nodeId: 'health_quality', delta: 0.06, duration: 3 },
            { nodeId: 'technology_level', delta: -0.08, duration: 3 },
            { nodeId: 'crime_rate', delta: -0.04, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'parents', delta: 0.2 },
            { groupId: 'retirees', delta: 0.15 },
            { groupId: 'tech_workers', delta: -0.25 },
          ],
        },
        {
          id: 'self_regulation',
          label: 'Encourage Industry Self-Regulation',
          description:
            'Establish a voluntary code of practice with industry participants. Cheaper and less confrontational, but critics say it will have no teeth.',
          effects: [
            { nodeId: 'technology_level', delta: 0.03, duration: 2 },
            { nodeId: 'health_quality', delta: 0.02, duration: 2 },
            { nodeId: 'crime_rate', delta: -0.01, duration: 1 },
          ],
          voterReactions: [
            { groupId: 'parents', delta: -0.08 },
            { groupId: 'tech_workers', delta: 0.15 },
            { groupId: 'retirees', delta: -0.1 },
          ],
        },
        {
          id: 'ban_platforms',
          label: 'Ban Non-Compliant Platforms',
          description:
            'Give platforms 90 days to meet Australian standards or face a complete ban. A dramatic move that would make international headlines and could isolate Australia digitally.',
          effects: [
            { nodeId: 'technology_level', delta: -0.15, duration: 4 },
            { nodeId: 'international_relations', delta: -0.1, duration: 3 },
            { nodeId: 'crime_rate', delta: -0.06, duration: 2 },
            { nodeId: 'health_quality', delta: 0.08, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'students', delta: -0.25 },
            { groupId: 'parents', delta: 0.15 },
            { groupId: 'tech_workers', delta: -0.3 },
          ],
        },
      ],
      oneShot: false,
    },

    // ================================================================
    // 11. UNIVERSITY FUNDING
    // ================================================================
    {
      id: 'university_funding',
      name: 'University Funding Crisis',
      headline: 'Universities Facing Financial Crisis',
      description:
        'The collapse in international student enrolments has pushed several major Australian universities to the brink of insolvency. Three Group of Eight institutions have requested emergency government funding, warning that without it they will be forced to cut 12,000 staff and close entire faculties. Regional universities face an even more dire outlook. The higher education sector contributes $40 billion annually to the economy, but critics say universities have been mismanaged and over-reliant on overseas fee revenue.',
      icon: '🎓',
      choices: [
        {
          id: 'bail_out_universities',
          label: 'Provide Emergency Bail-Out Funding',
          description:
            'Commit $8 billion in emergency stabilisation funding to keep universities solvent and protect research capacity. Attach conditions requiring governance reform.',
          effects: [
            { nodeId: 'public_debt', delta: 0.12, duration: 3 },
            { nodeId: 'education_quality', delta: 0.12, duration: 4 },
            { nodeId: 'technology_level', delta: 0.06, duration: 3 },
          ],
          voterReactions: [
            { groupId: 'students', delta: 0.25 },
            { groupId: 'public_servants', delta: 0.1 },
            { groupId: 'wealthy', delta: -0.15 },
          ],
        },
        {
          id: 'allow_closures',
          label: 'Allow Market Correction',
          description:
            'Let underperforming institutions restructure or close. Redirect some funding to TAFE and vocational education. Painful in the short term but forces the sector to become sustainable.',
          effects: [
            { nodeId: 'education_quality', delta: -0.1, duration: 3 },
            { nodeId: 'unemployment', delta: 0.08, duration: 2 },
            { nodeId: 'public_debt', delta: -0.04, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'students', delta: -0.25 },
            { groupId: 'workers', delta: 0.08 },
            { groupId: 'business_owners', delta: 0.1 },
          ],
        },
        {
          id: 'reform_funding_model',
          label: 'Comprehensive Funding Reform',
          description:
            'Redesign the entire higher education funding model: increase domestic student subsidies, cap international student dependence, and link funding to employment outcomes. A middle path that satisfies nobody perfectly.',
          effects: [
            { nodeId: 'education_quality', delta: 0.06, duration: 4 },
            { nodeId: 'public_debt', delta: 0.06, duration: 3 },
            { nodeId: 'unemployment', delta: -0.03, duration: 3 },
          ],
          voterReactions: [
            { groupId: 'students', delta: 0.05 },
            { groupId: 'business_owners', delta: -0.05 },
            { groupId: 'public_servants', delta: 0.05 },
          ],
        },
      ],
      oneShot: true,
    },

    // ================================================================
    // 12. NUCLEAR ENERGY
    // ================================================================
    {
      id: 'nuclear_energy',
      name: 'Nuclear Energy Debate',
      headline: 'Nuclear Energy Proposal',
      description:
        'A parliamentary inquiry has recommended lifting Australia\'s long-standing moratorium on nuclear power. Proponents argue that small modular reactors could provide reliable baseload energy to complement renewables and dramatically cut emissions. Opponents point to the unresolved waste storage question, the enormous capital cost, and Australia\'s abundant solar and wind resources. The debate cuts across traditional party lines and has divided the scientific community.',
      icon: '⚛️',
      choices: [
        {
          id: 'approve_nuclear',
          label: 'Lift the Ban and Build Reactors',
          description:
            'Amend the EPBC Act to permit nuclear energy. Commit to building two small modular reactor sites with completion targeted within 8 years. A bold move for energy security.',
          effects: [
            { nodeId: 'technology_level', delta: 0.12, duration: 4 },
            { nodeId: 'environment_quality', delta: 0.08, duration: 4 },
            { nodeId: 'public_debt', delta: 0.15, duration: 4 },
            { nodeId: 'gdp_growth', delta: 0.04, duration: 4 },
          ],
          voterReactions: [
            { groupId: 'business_owners', delta: 0.15 },
            { groupId: 'tech_workers', delta: 0.1 },
            { groupId: 'environmentalists', delta: -0.25 },
          ],
        },
        {
          id: 'invest_renewables',
          label: 'Double Down on Renewables',
          description:
            'Reject nuclear and instead invest the same capital in large-scale solar, wind, and battery storage. Australia already has the best renewable resources in the world; use them.',
          effects: [
            { nodeId: 'environment_quality', delta: 0.1, duration: 3 },
            { nodeId: 'public_debt', delta: 0.1, duration: 3 },
            { nodeId: 'technology_level', delta: 0.06, duration: 3 },
          ],
          voterReactions: [
            { groupId: 'environmentalists', delta: 0.25 },
            { groupId: 'farmers', delta: 0.08 },
            { groupId: 'business_owners', delta: -0.1 },
          ],
        },
        {
          id: 'delay_energy_decision',
          label: 'Commission Further Study',
          description:
            'Establish a royal commission into Australia\'s future energy mix to report in two years. Avoids committing to a divisive decision but delays critical energy infrastructure investment.',
          effects: [
            { nodeId: 'consumer_confidence', delta: -0.06, duration: 2 },
            { nodeId: 'technology_level', delta: -0.03, duration: 2 },
            { nodeId: 'environment_quality', delta: -0.03, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'environmentalists', delta: -0.08 },
            { groupId: 'business_owners', delta: -0.1 },
            { groupId: 'retirees', delta: 0.05 },
          ],
        },
      ],
      oneShot: true,
    },

    // ================================================================
    // 13. COST OF LIVING
    // ================================================================
    {
      id: 'cost_of_living',
      name: 'Cost of Living Emergency',
      headline: 'Cost of Living Crisis Deepens',
      description:
        'Inflation has surged past 7% and grocery prices have risen 15% in the past year. Mortgage holders are being crushed by successive interest rate rises. Renters face vacancy rates below 1% in major cities. Food banks report a 300% increase in demand. The Reserve Bank insists rates must stay high to tame inflation, but families are going without essentials. Pressure is mounting on the government to intervene.',
      icon: '💸',
      choices: [
        {
          id: 'cash_payments',
          label: 'Emergency Cash Payments',
          description:
            'Distribute a $1,500 one-off cost of living payment to all households earning under $120,000. Provides immediate relief but risks fuelling the inflation the RBA is trying to tame.',
          effects: [
            { nodeId: 'poverty_rate', delta: -0.1, duration: 2 },
            { nodeId: 'inflation', delta: 0.08, duration: 2 },
            { nodeId: 'public_debt', delta: 0.12, duration: 2 },
            { nodeId: 'consumer_confidence', delta: 0.1, duration: 1 },
          ],
          voterReactions: [
            { groupId: 'workers', delta: 0.2 },
            { groupId: 'retirees', delta: 0.15 },
            { groupId: 'wealthy', delta: -0.15 },
          ],
        },
        {
          id: 'targeted_subsidies',
          label: 'Targeted Subsidies and Relief',
          description:
            'Introduce energy bill rebates, rent assistance increases, and expanded bulk-billing incentives. More targeted and less inflationary, but slower to reach those in need.',
          effects: [
            { nodeId: 'poverty_rate', delta: -0.06, duration: 3 },
            { nodeId: 'inflation', delta: 0.03, duration: 1 },
            { nodeId: 'public_debt', delta: 0.07, duration: 3 },
            { nodeId: 'health_quality', delta: 0.04, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'workers', delta: 0.08 },
            { groupId: 'retirees', delta: 0.1 },
            { groupId: 'healthcare_workers', delta: 0.08 },
          ],
        },
        {
          id: 'austerity_response',
          label: 'Hold the Line on Spending',
          description:
            'Resist the urge to spend. Let monetary policy do its work and focus on reducing the deficit. Fiscally responsible but politically brutal in the face of visible suffering.',
          effects: [
            { nodeId: 'inflation', delta: -0.06, duration: 3 },
            { nodeId: 'public_debt', delta: -0.08, duration: 3 },
            { nodeId: 'poverty_rate', delta: 0.06, duration: 2 },
            { nodeId: 'consumer_confidence', delta: -0.08, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'workers', delta: -0.2 },
            { groupId: 'retirees', delta: -0.15 },
            { groupId: 'business_owners', delta: 0.15 },
          ],
        },
      ],
      condition: { nodeId: 'inflation', operator: '>', value: 0.6 },
      oneShot: false,
    },

    // ================================================================
    // 14. DEFENCE CONTRACT
    // ================================================================
    {
      id: 'defence_contract',
      name: 'Defence Procurement Decision',
      headline: 'Major Defence Contract Decision',
      description:
        'The Department of Defence needs to acquire a new fleet of armoured vehicles for the Australian Army. Three options are on the table: an Australian-designed and manufactured vehicle that would sustain thousands of jobs but costs 40% more and will take years longer to deliver; a proven foreign design available immediately at lower cost; or a joint venture that splits production between Australia and an allied nation. Defence strategists warn that the current fleet is dangerously outdated.',
      icon: '🛡️',
      choices: [
        {
          id: 'buy_australian',
          label: 'Build Australian',
          description:
            'Commission the Australian-designed vehicle. Invest in sovereign defence manufacturing capability even at a significant cost premium and delivery delay.',
          effects: [
            { nodeId: 'public_debt', delta: 0.14, duration: 4 },
            { nodeId: 'unemployment', delta: -0.06, duration: 4 },
            { nodeId: 'technology_level', delta: 0.08, duration: 4 },
          ],
          voterReactions: [
            { groupId: 'workers', delta: 0.2 },
            { groupId: 'public_servants', delta: 0.1 },
            { groupId: 'wealthy', delta: -0.1 },
          ],
        },
        {
          id: 'buy_foreign',
          label: 'Buy Off the Shelf',
          description:
            'Purchase the proven foreign vehicle for immediate delivery. Get the best equipment at the best price and stop wasting money trying to reinvent the wheel.',
          effects: [
            { nodeId: 'public_debt', delta: 0.06, duration: 2 },
            { nodeId: 'international_relations', delta: 0.06, duration: 2 },
            { nodeId: 'unemployment', delta: 0.03, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'workers', delta: -0.2 },
            { groupId: 'business_owners', delta: 0.12 },
            { groupId: 'public_servants', delta: -0.05 },
          ],
        },
        {
          id: 'joint_venture',
          label: 'Joint Venture with Ally',
          description:
            'Partner with an allied nation to co-develop and co-produce the vehicles. Shares costs and risks while maintaining some domestic industrial base. Neither the cheapest nor the most Australian option.',
          effects: [
            { nodeId: 'public_debt', delta: 0.1, duration: 3 },
            { nodeId: 'international_relations', delta: 0.08, duration: 3 },
            { nodeId: 'technology_level', delta: 0.05, duration: 3 },
            { nodeId: 'unemployment', delta: -0.03, duration: 3 },
          ],
          voterReactions: [
            { groupId: 'workers', delta: 0.05 },
            { groupId: 'business_owners', delta: 0.05 },
            { groupId: 'public_servants', delta: 0.05 },
          ],
        },
      ],
      oneShot: true,
    },

    // ================================================================
    // 15. WHISTLEBLOWER
    // ================================================================
    {
      id: 'whistleblower',
      name: 'Government Whistleblower',
      headline: 'Government Whistleblower Reveals Waste',
      description:
        'A senior public servant has leaked documents to the media revealing systematic waste and mismanagement in a major government infrastructure program. The documents suggest $2.3 billion in cost overruns were concealed from parliament. The leak has dominated the news cycle. Opposition parties are demanding accountability. The public service union is warning that prosecuting the whistleblower will have a chilling effect on transparency. Meanwhile, some cabinet ministers want to make an example of the leaker to prevent future breaches.',
      icon: '🔔',
      choices: [
        {
          id: 'independent_inquiry',
          label: 'Launch an Independent Inquiry',
          description:
            'Establish a fully independent commission of inquiry with broad powers to investigate the waste. Accept the political damage in exchange for demonstrating commitment to transparency and accountability.',
          effects: [
            { nodeId: 'public_debt', delta: 0.04, duration: 2 },
            { nodeId: 'infrastructure_quality', delta: 0.08, duration: 3 },
            { nodeId: 'equality', delta: 0.06, duration: 2 },
          ],
          voterReactions: [
            { groupId: 'public_servants', delta: 0.2 },
            { groupId: 'workers', delta: 0.1 },
            { groupId: 'business_owners', delta: -0.08 },
          ],
        },
        {
          id: 'internal_review',
          label: 'Conduct an Internal Review',
          description:
            'Order the department to conduct its own internal review and report back to the minister. Keeps the matter contained but will be seen by many as a cover-up.',
          effects: [
            { nodeId: 'consumer_confidence', delta: -0.08, duration: 2 },
            { nodeId: 'equality', delta: -0.04, duration: 2 },
            { nodeId: 'public_debt', delta: -0.02, duration: 1 },
          ],
          voterReactions: [
            { groupId: 'public_servants', delta: -0.1 },
            { groupId: 'workers', delta: -0.1 },
            { groupId: 'business_owners', delta: 0.08 },
          ],
        },
        {
          id: 'prosecute_whistleblower',
          label: 'Prosecute the Whistleblower',
          description:
            'Refer the leaker to the Australian Federal Police for prosecution under official secrets legislation. Send a clear message that unauthorised disclosures will not be tolerated, regardless of content.',
          effects: [
            { nodeId: 'equality', delta: -0.1, duration: 3 },
            { nodeId: 'crime_rate', delta: -0.02, duration: 1 },
            { nodeId: 'consumer_confidence', delta: -0.12, duration: 3 },
          ],
          voterReactions: [
            { groupId: 'public_servants', delta: -0.25 },
            { groupId: 'workers', delta: -0.15 },
            { groupId: 'students', delta: -0.2 },
          ],
        },
      ],
      oneShot: true,
    },
  ];
}
