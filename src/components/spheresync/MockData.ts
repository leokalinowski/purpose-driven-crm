export type Channel = 'call' | 'text' | 'email';
export type PriorityPill = 'top' | 'today' | 'cold' | 'stale' | 'done' | 'muted';

export interface PriorityItem {
  id: string;
  initials: string;
  name: string;
  pills: { label: string; tone: PriorityPill }[];
  meta: string;
  why?: string;
  type: Channel;
  done?: boolean;
}

export const focusContact = {
  initials: 'JM',
  name: 'Jennifer Martinez',
  phone: '(206) 555-0142',
  email: 'jennifer.m@example.com',
  why: 'Last touch Feb 14 · 2 referrals to date · warm → cooling',
  headline: "Jennifer Martinez — she's 47 days cold and about to age out.",
  context:
    "Past client from 2019, sent you two referrals. Her birthday's in five weeks — a warm \"thinking of you\" now keeps her in the warm segment and teed up for an April touch.",
};

export const sideStats = [
  { label: "This week's calls", num: 42, total: 50, pct: 84, remaining: 8, accent: false },
  { label: 'Texts sent', num: 28, total: 30, pct: 93, remaining: 2, accent: true },
];

export const streak = { weeks: 6, label: '6 weeks 100%' };

export const cadenceWeek: { dow: string; dom: number; today?: boolean; dots: ('call' | 'text' | 'event')[] }[] = [
  { dow: 'Mon', dom: 3, dots: ['call', 'text'] },
  { dow: 'Tue', dom: 4, today: true, dots: [] },
  { dow: 'Wed', dom: 5, dots: ['call'] },
  { dow: 'Thu', dom: 6, dots: ['call', 'event'] },
  { dow: 'Fri', dom: 7, dots: ['text'] },
  { dow: 'Sat', dom: 8, dots: ['event'] },
  { dow: 'Sun', dom: 9, dots: [] },
];

export const weekHint = {
  weekNumber: 10,
  textLetters: ['C', 'D', 'E', 'F'],
  highlight: 'M',
};

export const priorityItems: PriorityItem[] = [
  {
    id: 'p1',
    initials: 'JM',
    name: 'Jennifer Martinez',
    pills: [
      { label: '47d cold', tone: 'cold' },
      { label: 'Top pick', tone: 'top' },
    ],
    meta: 'Past client · 2019 · 2 referrals · birthday Apr 12',
    why: 'Cooling off — Coach wants her re-engaged before her birthday touch',
    type: 'call',
  },
  {
    id: 'p2',
    initials: 'DC',
    name: 'David Chen',
    pills: [{ label: 'Today', tone: 'today' }],
    meta: 'Sphere · referral source · quarterly check-in · 28 days since last touch',
    why: "Sent you 3 referrals — he's worth a real conversation",
    type: 'call',
  },
  {
    id: 'p3',
    initials: 'PB',
    name: 'Priya Bhattacharya',
    pills: [{ label: 'Today', tone: 'today' }],
    meta: 'Past client · 2020 · 4 referrals · home anniversary Jun 3',
    why: 'Warm touch, low effort — she opens every email you send',
    type: 'call',
  },
  {
    id: 'p4',
    initials: 'MR',
    name: 'Michelle Rodriguez',
    pills: [{ label: 'Stale', tone: 'stale' }],
    meta: 'Open-house lead · Feb 10 · browsing $500–650K in Ravenna',
    why: 'Coach risk: aging out of hot-lead window',
    type: 'text',
  },
  {
    id: 'p5',
    initials: 'SK',
    name: 'Sarah & Tom Kowalski',
    pills: [{ label: 'Done Mon', tone: 'done' }],
    meta: 'Past client · 2022 · home anniversary Jun 3 · logged 12 min call',
    type: 'call',
    done: true,
  },
  {
    id: 'p6',
    initials: 'AK',
    name: 'Amir Khan',
    pills: [{ label: 'Month 6', tone: 'muted' }],
    meta: 'Past client · 2023 · likes to be texted, not called',
    why: 'Preferred channel is text — script queued',
    type: 'text',
  },
  {
    id: 'p7',
    initials: 'LO',
    name: "Liam O'Brien",
    pills: [],
    meta: 'Sphere · attorney referral partner · last touch 35d',
    type: 'call',
  },
];

export const priorityFilters = [
  { key: 'all', label: 'All', count: 12 },
  { key: 'overdue', label: 'Overdue', count: 3 },
  { key: 'today', label: 'Today', count: 6 },
  { key: 'calls', label: 'Calls', count: 8 },
  { key: 'texts', label: 'Texts', count: 4 },
];

// ---------------------------- Pipeline ----------------------------

export type DealStage = 'lead' | 'active' | 'contract' | 'closing' | 'closed';

export interface Deal {
  id: string;
  name: string;
  detail: string;
  price: string;
  nudge?: { tone: 'good' | 'regular' | 'warn'; label: string };
  stage: DealStage;
}

export const dealsByStage: Record<DealStage, Deal[]> = {
  lead: [
    {
      id: 'd1',
      name: 'Marcus Webb',
      detail: 'Buyer · pre-approved $650K',
      price: '~$650K',
      nudge: { tone: 'good', label: 'Hot · responded today' },
      stage: 'lead',
    },
    {
      id: 'd2',
      name: 'The Patels',
      detail: 'Looking · 30001',
      price: '$800K',
      nudge: { tone: 'regular', label: 'Send blueprint' },
      stage: 'lead',
    },
    {
      id: 'd3',
      name: 'Michelle Rodriguez',
      detail: 'Open-house · Ravenna',
      price: '$525–650K',
      nudge: { tone: 'warn', label: 'Aging — 12d' },
      stage: 'lead',
    },
  ],
  active: [
    {
      id: 'd4',
      name: 'Erika Olafsson',
      detail: '22 Birch Ln · listed',
      price: '$1.1M',
      nudge: { tone: 'good', label: '4 showings booked' },
      stage: 'active',
    },
    {
      id: 'd5',
      name: 'Henry Vu',
      detail: 'Touring Sat · 3 homes',
      price: '$725K',
      nudge: { tone: 'regular', label: 'Confirm Sat tour' },
      stage: 'active',
    },
    {
      id: 'd6',
      name: 'The Bauers',
      detail: 'Listing prep · photo Mar 6',
      price: '$895K',
      stage: 'active',
    },
  ],
  contract: [
    {
      id: 'd7',
      name: '1801 Aster Way',
      detail: 'Inspection Mar 8',
      price: '$890K',
      nudge: { tone: 'regular', label: 'Inspection in 4d' },
      stage: 'contract',
    },
    {
      id: 'd8',
      name: 'The Cohens',
      detail: 'Appraisal pending',
      price: '$1.25M',
      stage: 'contract',
    },
  ],
  closing: [
    {
      id: 'd9',
      name: 'The Reillys',
      detail: 'Closes Mar 14',
      price: '$640K',
      nudge: { tone: 'good', label: 'Clear to close' },
      stage: 'closing',
    },
    {
      id: 'd10',
      name: 'Nina Park',
      detail: 'Final walk Mar 12',
      price: '$540K',
      stage: 'closing',
    },
  ],
  closed: [
    {
      id: 'd11',
      name: 'S. Kowalski',
      detail: 'Feb 24 · gift sent',
      price: '$525K',
      stage: 'closed',
    },
    {
      id: 'd12',
      name: 'The Hendersons',
      detail: 'Feb 18',
      price: '$720K',
      stage: 'closed',
    },
  ],
};

export const pipelineSummary: { stage: DealStage; label: string; count: number; volume: string }[] = [
  { stage: 'lead', label: 'Lead', count: 12, volume: '$8.2M' },
  { stage: 'active', label: 'Active', count: 7, volume: '$6.1M' },
  { stage: 'contract', label: 'Contract', count: 3, volume: '$3.0M' },
  { stage: 'closing', label: 'Closing', count: 2, volume: '$1.2M' },
  { stage: 'closed', label: 'Closed (30d)', count: 4, volume: '$2.4M' },
];

export const gciForecast: { month: string; amount: number; height: number }[] = [
  { month: 'Mar', amount: 28000, height: 35 },
  { month: 'Apr', amount: 42000, height: 55 },
  { month: 'May', amount: 64000, height: 80 },
  { month: 'Jun', amount: 51000, height: 65 },
  { month: 'Jul', amount: 72000, height: 92 },
  { month: 'Aug', amount: 38000, height: 48 },
];

// ---------------------------- Database ----------------------------

export type Temperature = 'hot' | 'warm' | 'cool' | 'cold';
export type Relationship = 'past-client' | 'sphere' | 'lead' | 'partner';

export interface DbContact {
  id: string;
  initials: string;
  name: string;
  email: string;
  phone: string;
  relationship: Relationship;
  temperature: Temperature;
  lastTouch: string;
  tags: string[];
}

export const dbContacts: DbContact[] = [
  {
    id: 'c1',
    initials: 'JM',
    name: 'Jennifer Martinez',
    email: 'jennifer.m@example.com',
    phone: '(206) 555-0142',
    relationship: 'past-client',
    temperature: 'cold',
    lastTouch: '47d ago',
    tags: ['2019', 'referral source'],
  },
  {
    id: 'c2',
    initials: 'DC',
    name: 'David Chen',
    email: 'david.chen@example.com',
    phone: '(206) 555-0188',
    relationship: 'sphere',
    temperature: 'warm',
    lastTouch: '28d ago',
    tags: ['referral source'],
  },
  {
    id: 'c3',
    initials: 'PB',
    name: 'Priya Bhattacharya',
    email: 'priya.b@example.com',
    phone: '(425) 555-0177',
    relationship: 'past-client',
    temperature: 'warm',
    lastTouch: '12d ago',
    tags: ['2020', '4 referrals'],
  },
  {
    id: 'c4',
    initials: 'SK',
    name: 'Sarah & Tom Kowalski',
    email: 'kowalskis@example.com',
    phone: '(360) 555-0119',
    relationship: 'past-client',
    temperature: 'hot',
    lastTouch: '2d ago',
    tags: ['2022', 'anniversary Jun'],
  },
  {
    id: 'c5',
    initials: 'MR',
    name: 'Michelle Rodriguez',
    email: 'mrodriguez@example.com',
    phone: '(206) 555-0234',
    relationship: 'lead',
    temperature: 'warm',
    lastTouch: '5d ago',
    tags: ['open-house', 'Ravenna'],
  },
  {
    id: 'c6',
    initials: 'AK',
    name: 'Amir Khan',
    email: 'amir.k@example.com',
    phone: '(206) 555-0451',
    relationship: 'past-client',
    temperature: 'cool',
    lastTouch: '63d ago',
    tags: ['2023', 'text only'],
  },
  {
    id: 'c7',
    initials: 'LO',
    name: "Liam O'Brien",
    email: 'liam@obrienlaw.example.com',
    phone: '(206) 555-0512',
    relationship: 'partner',
    temperature: 'warm',
    lastTouch: '35d ago',
    tags: ['attorney'],
  },
  {
    id: 'c8',
    initials: 'EO',
    name: 'Erika Olafsson',
    email: 'erika.o@example.com',
    phone: '(425) 555-0671',
    relationship: 'lead',
    temperature: 'hot',
    lastTouch: '1d ago',
    tags: ['seller', 'Birch Ln'],
  },
  {
    id: 'c9',
    initials: 'HV',
    name: 'Henry Vu',
    email: 'henryv@example.com',
    phone: '(206) 555-0782',
    relationship: 'lead',
    temperature: 'hot',
    lastTouch: '3d ago',
    tags: ['buyer', 'pre-approved'],
  },
  {
    id: 'c10',
    initials: 'MW',
    name: 'Marcus Webb',
    email: 'marcus.w@example.com',
    phone: '(206) 555-0890',
    relationship: 'lead',
    temperature: 'hot',
    lastTouch: 'today',
    tags: ['buyer', 'pre-approved'],
  },
  {
    id: 'c11',
    initials: 'TP',
    name: 'The Patels',
    email: 'patels@example.com',
    phone: '(425) 555-0930',
    relationship: 'lead',
    temperature: 'warm',
    lastTouch: '7d ago',
    tags: ['buyer'],
  },
  {
    id: 'c12',
    initials: 'TR',
    name: 'The Reillys',
    email: 'reillys@example.com',
    phone: '(206) 555-1011',
    relationship: 'past-client',
    temperature: 'hot',
    lastTouch: '4d ago',
    tags: ['closing Mar 14'],
  },
];

export const databaseStats = [
  { label: 'Total contacts', value: '1,287' },
  { label: 'Hot', value: '24' },
  { label: 'Warm', value: '418' },
  { label: 'Cold', value: '127' },
];
