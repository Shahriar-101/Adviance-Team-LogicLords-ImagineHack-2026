export const DEMO_DATE = '2026-06-20';

export const NEED_CATEGORIES = [
  'Estate Planning',
  'Tax Planning',
  'Takaful & Protection',
  'Retirement Planning',
  'SME Business Succession',
];

export const CLIENT_NEEDS = [
  'Retirement planning',
  'Estate planning',
  'Business succession',
  'Tax planning',
  'Takaful & protection',
  'General portfolio review',
];

export const seedState = {
  user: { name: 'Ahmad Rahman', email: 'ahmad@adviance.demo' },
  clients: [
    {
      id: 'c1',
      name: 'David Lim',
      email: 'david.lim@example.com',
      lastContact: '2026-05-21',
      portfolioValue: 420000,
      portfolioChange: -7.8,
      lifeEvent: 'Retirement planning',
      notes: [
        { date: '2026-06-10', text: 'David sounded anxious about recent portfolio volatility and asked whether to withdraw a portion before retirement.' },
        { date: '2026-05-21', text: 'Reviewed retirement timeline. Needs reassurance and a clear next-step plan.' },
      ],
    },
    {
      id: 'c2',
      name: 'Ahmad Razif',
      email: 'ahmad.razif@example.com',
      lastContact: '2026-06-03',
      portfolioValue: 285000,
      portfolioChange: -5.9,
      lifeEvent: 'Business succession',
      notes: [{ date: '2026-06-03', text: 'Owns a growing SME and is beginning to ask about business exit options.' }],
    },
    {
      id: 'c3',
      name: 'Siti Norzaha',
      email: 'siti.n@example.com',
      lastContact: '2026-06-18',
      portfolioValue: 360000,
      portfolioChange: 2.1,
      lifeEvent: 'Retirement planning',
      notes: [{ date: '2026-06-18', text: 'Routine review completed. Interested in improving retirement income certainty.' }],
    },
    {
      id: 'c4',
      name: 'Tan Wei Ming',
      email: 'tan.wm@example.com',
      lastContact: '2026-06-08',
      portfolioValue: 195000,
      portfolioChange: -1.2,
      lifeEvent: 'Estate planning',
      notes: [{ date: '2026-06-08', text: 'New business owner. Mentioned he has not formalised an estate plan.' }],
    },
    {
      id: 'c5',
      name: 'Nur Aisyah',
      email: 'nur.aisyah@example.com',
      lastContact: '2026-06-12',
      portfolioValue: 230000,
      portfolioChange: 1.8,
      lifeEvent: 'Takaful & protection',
      notes: [],
    },
  ],
  meetings: [
    { id: 'm1', clientId: 'c3', date: DEMO_DATE, time: '10:00', topic: 'Portfolio review', teamsLink: 'https://teams.microsoft.com/l/meetup-join/demo-siti', done: false },
    { id: 'm2', clientId: 'c1', date: DEMO_DATE, time: '14:00', topic: 'Reassurance call', teamsLink: 'https://teams.microsoft.com/l/meetup-join/demo-david', done: false },
    { id: 'm3', clientId: 'c4', date: DEMO_DATE, time: '16:30', topic: 'Estate planning discovery', teamsLink: '', done: true },
  ],
  followups: [
    { id: 'f1', clientId: 'c1', task: 'Send retirement reassurance summary', dueDate: '2026-06-18', done: false },
    { id: 'f2', clientId: 'c2', task: 'Review SME succession note', dueDate: '2026-06-21', done: false },
    { id: 'f3', clientId: 'c4', task: 'Confirm estate planning documents', dueDate: '2026-06-23', done: false },
  ],
  expenses: [
    { id: 'e1', category: 'Client meals', amount: 480, description: 'Client lunches' },
    { id: 'e2', category: 'Travel', amount: 320, description: 'Local client travel' },
    { id: 'e3', category: 'Learning', amount: 440, description: 'CPD materials' },
  ],
  courses: [
    { id: 'co1', title: 'EPF & Retirement Strategies', category: 'Retirement planning', hours: 3, description: 'Malaysia-focused retirement needs, EPF considerations, and client discussion pathways.', completed: false },
    { id: 'co2', title: 'Takaful & Islamic Finance Essentials', category: 'Takaful & protection', hours: 3, description: 'A practical CPD module on Takaful structures and suitability conversations.', completed: false },
    { id: 'co3', title: 'SME Business Succession', category: 'Business succession', hours: 2, description: 'Business continuation, succession triggers, and referral readiness for SME owners.', completed: false },
    { id: 'co4', title: 'Estate Planning & Wasiat Fundamentals', category: 'Estate planning', hours: 3, description: 'Foundations of Wasiat, estate planning needs, and client preparation.', completed: false },
    { id: 'co5', title: 'Tax Planning for Professionals', category: 'Tax planning', hours: 2, description: 'Core tax-planning concepts for client conversations and specialist referrals.', completed: false },
    { id: 'co6', title: 'Client Communication During Volatility', category: 'General portfolio review', hours: 2, description: 'Practical communication principles when clients feel anxious about markets.', completed: true },
    { id: 'co7', title: 'Ethics & Suitability in Financial Advice', category: 'General portfolio review', hours: 2, description: 'Professional practice, documentation, and responsible recommendations.', completed: false },
    { id: 'co8', title: 'Retirement Income Conversations', category: 'Retirement planning', hours: 3, description: 'Supporting clients approaching retirement with confidence and clarity.', completed: false },
  ],
  partners: [
    { id: 'p1', name: 'Lim & Co. Legal', initials: 'LC', category: 'Estate Planning', expertise: 'Wasiat, estate planning & inheritance coordination', lastReferral: '2026-06-06', recentSuccesses: 3, email: 'contact@limco.demo' },
    { id: 'p2', name: 'Encik Farid Hassan', initials: 'FH', category: 'SME Business Succession', expertise: 'Corporate law, SME succession & shareholder arrangements', lastReferral: '2026-06-15', recentSuccesses: 3, email: 'farid@hassanlaw.demo' },
    { id: 'p3', name: 'Tan Tax Partners', initials: 'TT', category: 'Tax Planning', expertise: 'Individual tax planning & business tax structuring', lastReferral: '2026-04-10', recentSuccesses: 1, email: 'hello@tantax.demo' },
    { id: 'p4', name: 'Dr. Nurul Aina', initials: 'NA', category: 'Takaful & Protection', expertise: 'Family Takaful, protection reviews & Islamic finance', lastReferral: '2026-06-02', recentSuccesses: 2, email: 'nurul@takaful.demo' },
    { id: 'p5', name: 'RetireRight Advisory', initials: 'RR', category: 'Retirement Planning', expertise: 'Retirement income planning & EPF transition support', lastReferral: '2026-05-17', recentSuccesses: 2, email: 'team@retireright.demo' },
  ],
  referrals: [
    { id: 'r1', clientId: 'c2', partnerId: 'p2', category: 'SME Business Succession', date: '2026-06-15', outcome: 'Successful' },
    { id: 'r2', clientId: 'c4', partnerId: 'p1', category: 'Estate Planning', date: '2026-06-06', outcome: 'Pending' },
    { id: 'r3', clientId: 'c5', partnerId: 'p4', category: 'Takaful & Protection', date: '2026-06-02', outcome: 'Successful' },
  ],
};
