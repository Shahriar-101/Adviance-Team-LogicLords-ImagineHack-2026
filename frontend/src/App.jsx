import { useEffect, useMemo, useState } from 'react';
import { CLIENT_NEEDS, DEMO_DATE, NEED_CATEGORIES, seedState } from './data.js';
import { api } from './api.js';

const STORAGE_KEY = 'adviance_react_mvp_v1';
const SESSION_KEY = 'adviance_react_session';
const ADVISOR_KEY = 'adviance_registered_advisor';

const clone = (value) => JSON.parse(JSON.stringify(value));
const makeId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

function loadSavedData() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : clone(seedState);
  } catch {
    return clone(seedState);
  }
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value) {
  if (!value) return '';
  const [hour, minute] = value.split(':').map(Number);
  return new Intl.DateTimeFormat('en-MY', { hour: 'numeric', minute: '2-digit' }).format(new Date(2026, 5, 20, hour, minute));
}

function daysBetween(from, to = DEMO_DATE) {
  return Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000);
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function clientToPartnerCategory(lifeEvent = '') {
  const value = lifeEvent.toLowerCase();
  if (value.includes('estate')) return 'Estate Planning';
  if (value.includes('tax')) return 'Tax Planning';
  if (value.includes('takaful') || value.includes('protection')) return 'Takaful & Protection';
  if (value.includes('retirement')) return 'Retirement Planning';
  if (value.includes('business')) return 'SME Business Succession';
  return 'Retirement Planning';
}

function sentimentScore(client) {
  const notes = client.notes.map((note) => note.text.toLowerCase()).join(' ');
  const triggers = ['anxious', 'worried', 'volatility', 'withdraw', 'uncertain', 'concerned', 'risk'];
  return triggers.reduce((score, trigger) => score + (notes.includes(trigger) ? 5 : 0), 0);
}

function priorityInfo(data, client) {
  const recency = Math.min(Math.max(daysBetween(client.lastContact), 0) * 1.6, 35);
  const followups = data.followups.filter((item) => item.clientId === client.id && !item.done).length * 12;
  const meetingProximity = data.meetings.some((item) => item.clientId === client.id && item.date === DEMO_DATE && !item.done) ? 18 : 0;
  const portfolio = Math.min(Math.abs(Math.min(Number(client.portfolioChange || 0), 0)) * 2.4, 18);
  const sentiment = Math.min(sentimentScore(client), 16);
  const score = Math.round(Math.min(recency + followups + meetingProximity + portfolio + sentiment, 100));
  return {
    score,
    label: score >= 65 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW',
    parts: { recency, followups, meetingProximity, portfolio, sentiment },
  };
}

function partnerHealth(partner) {
  const age = daysBetween(partner.lastReferral);
  return age <= 21 ? 'Hot' : age <= 60 ? 'Warm' : 'Cold';
}

function practiceMetrics(data) {
  const engaged = data.clients.filter((client) => client.notes.length > 0 || data.meetings.some((meeting) => meeting.clientId === client.id && meeting.done)).length;
  const clientEngagement = Math.round((engaged / Math.max(data.clients.length, 1)) * 100);
  const completedMeetings = data.meetings.filter((meeting) => meeting.done).length;
  const deadlineReliability = Math.round((completedMeetings / Math.max(data.meetings.length, 1)) * 100);
  const activePartners = data.partners.filter((partner) => partnerHealth(partner) !== 'Cold').length;
  const successfulReferrals = data.referrals.filter((referral) => referral.outcome === 'Successful').length;
  const partnerActivity = Math.min(100, Math.round((activePartners / Math.max(data.partners.length, 1)) * 70 + (successfulReferrals / Math.max(data.referrals.length, 1)) * 30));
  const clientVolume = Math.min(100, Math.round((data.clients.length / 12) * 100));
  const practiceScore = Math.round(clientVolume * 0.45 + partnerActivity * 0.55);
  return { clientEngagement, deadlineReliability, partnerActivity, clientVolume, practiceScore, engaged, activePartners, successfulReferrals };
}

function getLearningRecommendation(data) {
  const counts = {};
  data.clients.forEach((client) => { counts[client.lifeEvent] = (counts[client.lifeEvent] || 0) + 1; });
  const candidates = data.courses
    .filter((course) => !course.completed)
    .map((course) => ({ course, count: counts[course.category] || 0 }))
    .sort((a, b) => b.count - a.count);
  const best = candidates[0];
  if (!best || best.count === 0) {
    return { title: 'Ethics & Suitability in Financial Advice', count: 0, clients: [], copy: 'Your client book is currently well covered. Continue with this approved module to strengthen practice quality.' };
  }
  const clientNames = data.clients.filter((client) => client.lifeEvent === best.course.category).slice(0, 3).map((client) => client.name);
  return {
    title: best.course.title,
    count: best.count,
    clients: clientNames,
    copy: `${best.count} client${best.count === 1 ? '' : 's'} in your saved Client Memory need support related to ${best.course.category.toLowerCase()}.`,
  };
}

function getMorningBriefing(data) {
  const todayMeetings = data.meetings.filter((meeting) => meeting.date === DEMO_DATE);
  const urgentFollowups = data.followups.filter((item) => !item.done && daysBetween(item.dueDate) >= 0);
  const ranked = [...data.clients].sort((a, b) => priorityInfo(data, b).score - priorityInfo(data, a).score);
  const top = ranked[0];
  const priority = priorityInfo(data, top);
  const reasons = [];
  if (daysBetween(top.lastContact) > 14) reasons.push(`${daysBetween(top.lastContact)} days since last contact`);
  if (priority.parts.followups) reasons.push('an open follow-up');
  if (priority.parts.portfolio) reasons.push(`a ${Math.abs(top.portfolioChange)}% portfolio decline`);
  if (priority.parts.sentiment) reasons.push('concern in advisor notes');
  return {
    todayMeetings: todayMeetings.length,
    urgentFollowups: urgentFollowups.length,
    top,
    reasons: reasons.length ? reasons.join(', ') : 'their latest context requires review',
  };
}

function useBackendData() {
  const [data, setData] = useState(loadSavedData);
  const [backendStatus, setBackendStatus] = useState('loading');

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    api.getState()
      .then((savedState) => {
        if (cancelled) return;
        setData(savedState);
        setBackendStatus('connected');
      })
      .catch(() => {
        if (!cancelled) setBackendStatus('offline');
      });
    return () => { cancelled = true; };
  }, []);

  const update = (updater) => {
    setData((current) => {
      const next = clone(current);
      const result = updater(next);
      const updated = result || next;
      api.saveState(updated)
        .then(() => setBackendStatus('connected'))
        .catch(() => setBackendStatus('offline'));
      return updated;
    });
  };

  const reset = async () => {
    const state = await api.resetState();
    setData(state);
    setBackendStatus('connected');
    return state;
  };

  return [data, update, setData, backendStatus, reset];
}
function App() {
  const [data, updateData, setData, backendStatus, resetBackendData] = useBackendData();
  const [signedIn, setSignedIn] = useState(() => window.sessionStorage.getItem(SESSION_KEY) === 'true');
  const [advisor, setAdvisor] = useState(() => {
    try { return JSON.parse(window.sessionStorage.getItem(ADVISOR_KEY) || 'null'); } catch { return null; }
  });
  const [page, setPage] = useState('dashboard');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  };

  const signIn = (session) => {
    updateData((next) => { next.user.name = session.user.name; next.user.email = session.user.email; return next; });
    window.sessionStorage.setItem(SESSION_KEY, 'true');
    window.sessionStorage.setItem(ADVISOR_KEY, JSON.stringify(session));
    setAdvisor(session);
    setSignedIn(true);
    notify(`Welcome${session.user.name ? `, ${session.user.name.split(' ')[0]}` : ''}.`);
  };

  const signOut = () => {
    api.auth.logout(advisor?.token).catch(() => {});
    window.sessionStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(ADVISOR_KEY);
    setAdvisor(null);
    setSignedIn(false);
    setPage('dashboard');
    setModal(null);
  };

  const resetDemo = async () => {
    try {
      await resetBackendData();
      notify('Demo data reset in the backend database.');
    } catch {
      setData(clone(seedState));
      notify('Backend is unavailable. Local demo data was reset instead.');
    }
  };

  if (!signedIn) return <LoginScreen onLogin={signIn} />;

  return (
    <div className="app-view">
      <TopNav page={page} onNavigate={setPage} onLogout={signOut} advisor={advisor?.user || data.user} />
      <main className="main-content">
        {page === 'dashboard' && <Dashboard data={data} updateData={updateData} onModal={setModal} notify={notify} advisor={advisor?.user || data.user} />}
        {page === 'learning' && <LearningHub data={data} updateData={updateData} notify={notify} />}
        {page === 'partners' && <PartnerFinder data={data} updateData={updateData} onModal={setModal} notify={notify} />}
        {page === 'growth' && <Growth data={data} />}
      </main>
      <footer className="demo-footer"><span>React + Node backend · <strong className={`backend-status ${backendStatus}`}>Backend {backendStatus}</strong></span><button onClick={resetDemo}>Reset demo data</button></footer>
      {modal && <ModalHost modal={modal} data={data} updateData={updateData} close={() => setModal(null)} notify={notify} />}
      <div className={`toast ${toast ? '' : 'hidden'}`} role="status">{toast}</div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('ahmad@adviance.demo');
  const [password, setPassword] = useState('adviance2026');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    if (nextMode === 'register') {
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } else {
      setEmail('ahmad@adviance.demo');
      setPassword('adviance2026');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!email.includes('@')) return setError('Enter a valid email address.');
    if (password.trim().length < 8) return setError('Password must contain at least 8 characters.');
    if (mode === 'register') {
      if (name.trim().length < 2) return setError('Enter your full name.');
      if (password !== confirmPassword) return setError('Passwords do not match.');
    }
    setLoading(true);
    try {
      const session = mode === 'register'
        ? await api.auth.register({ name: name.trim(), email: email.trim(), password })
        : await api.auth.login({ email: email.trim(), password });
      onLogin(session);
    } catch (requestError) {
      setError(requestError.message || 'We could not complete that request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-view" aria-label="Adviance authentication">
      <div className="login-copy">
        <div className="login-brand"><img src="./adviance-logo.jpg" alt="Adviance logo" /><span>Adviance</span></div>
        <div className="login-copy-inner">
          <p className="eyebrow light">Advisor intelligence, made practical</p>
          <h1>One place to know<br /><em>who needs you next.</em></h1>
          <p>Adviance connects client memory, professional learning, and trusted partner referrals into one focused daily workflow.</p>
          <div className="value-list">
            <div><span>01</span>Prioritise client attention</div>
            <div><span>02</span>Learn from needs in your client book</div>
            <div><span>03</span>Match authorised specialists with confidence</div>
          </div>
        </div>
        <p className="login-foot">Secure advisory workspace · React + Node MVP</p>
      </div>
      <div className="login-panel-wrap">
        <form className="login-panel" onSubmit={submit}>
          <div className="auth-tabs" role="tablist" aria-label="Authentication options">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Sign in</button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Register</button>
          </div>
          <div className="login-panel-top"><span className="login-icon">↗</span><p className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Create your workspace'}</p><h2>{mode === 'login' ? 'Sign in to Adviance' : 'Register as an advisor'}</h2><p>{mode === 'login' ? 'Use the demo account or your registered advisor credentials.' : 'Create an advisor account for this local hackathon workspace.'}</p></div>
          {mode === 'register' && <label>Full name<input type="text" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="e.g. Amina Rahman" required /></label>}
          <label>Work email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>
          {mode === 'register' && <label>Confirm password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required /></label>}
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Enter Adviance' : 'Create advisor workspace'} <span>→</span></button>
          {mode === 'login' ? <p className="demo-note"><strong>Demo account:</strong> ahmad@adviance.demo · adviance2026</p> : <p className="demo-note">For the MVP, registration creates a local advisor account. The shared demo client data remains fictional.</p>}
        </form>
      </div>
    </section>
  );
}

function TopNav({ page, onNavigate, onLogout, advisor }) {
  const items = [
    ['dashboard', '⌂', 'Dashboard'],
    ['learning', '◫', 'Learning hub'],
    ['partners', '⌘', 'Partner finder'],
    ['growth', '↗', 'Growth'],
  ];
  return (
    <header className="topbar" aria-label="Main navigation">
      <div className="topbar-inner">
        <button className="top-brand" onClick={() => onNavigate('dashboard')}><img src="./adviance-logo.jpg" alt="Adviance logo" /><span>Adviance</span></button>
        <nav className="top-nav" aria-label="Primary">
          {items.map(([id, icon, label]) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => onNavigate(id)}><span className="nav-icon">{icon}</span><span>{label}</span></button>)}
        </nav>
        <div className="topbar-actions"><span className="date-label">Saturday, 20 June 2026</span><button className="icon-btn" title="Notifications">◌<span className="notification-dot" /></button><div className="top-user"><span className="avatar">{initials(advisor?.name || 'Advisor')}</span><span>{(advisor?.name || 'Advisor').split(' ')[0]}</span></div><button className="top-logout" onClick={onLogout}>Log out</button></div>
      </div>
    </header>
  );
}

function Dashboard({ data, updateData, onModal, notify, advisor }) {
  const dashboard = useMemo(() => getMorningBriefing(data), [data]);
  const metrics = practiceMetrics(data);
  const priorityClients = [...data.clients].sort((a, b) => priorityInfo(data, b).score - priorityInfo(data, a).score);
  const meetings = data.meetings.filter((meeting) => meeting.date === DEMO_DATE).sort((a, b) => a.time.localeCompare(b.time));
  const followups = data.followups.filter((followup) => !followup.done).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const totalExpenses = data.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const expenseBreakdown = data.expenses.reduce((result, item) => ({ ...result, [item.category]: (result[item.category] || 0) + Number(item.amount) }), {});
  const urgentFollowups = data.followups.filter((item) => !item.done && daysBetween(item.dueDate) >= 0).length;
  const highPriority = data.clients.filter((client) => priorityInfo(data, client).label === 'HIGH').length;

  const toggleMeeting = (meetingId, checked) => {
    updateData((next) => { const meeting = next.meetings.find((item) => item.id === meetingId); meeting.done = checked; return next; });
    notify(checked ? 'Meeting ticked — Deadline Reliability updated.' : 'Meeting re-opened.');
  };

  const toggleFollowup = (followupId, checked) => {
    updateData((next) => { const followup = next.followups.find((item) => item.id === followupId); followup.done = checked; return next; });
    notify(checked ? 'Follow-up marked complete. Growth remains unchanged by design.' : 'Follow-up re-opened.');
  };

  return (
    <section className="page active-page">
      <div className="page-heading split-heading"><div><p className="eyebrow">Advisor workspace</p><h1>Good morning, {(advisor?.name || data.user?.name || 'Advisor').split(' ')[0]}.</h1><p>Everything you need to make today count.</p></div><button className="btn btn-primary" onClick={() => onModal({ type: 'client' })}>+ Add client</button></div>
      <div className="stat-grid">
        <StatCard icon="◷" tone="blue" label="Meetings today" value={meetings.length} />
        <StatCard icon="✓" tone="amber" label="Urgent follow-ups" value={urgentFollowups} />
        <StatCard icon="!" tone="red" label="Need attention" value={highPriority} />
        <StatCard icon="↗" tone="green" label="Practice score" value={`${metrics.practiceScore}/100`} />
      </div>
      <article className="ai-briefing card"><div className="ai-heading"><span className="ai-spark">✦</span><div><span className="ai-label">AI briefing</span><h2>Your morning focus</h2></div><span className="refresh-note">Based on saved data</span></div><p className="briefing-text">You have <strong>{dashboard.todayMeetings} meetings</strong> scheduled today and <strong>{dashboard.urgentFollowups} follow-up{dashboard.urgentFollowups === 1 ? '' : 's'}</strong> due or overdue. <strong>{dashboard.top.name}</strong> should come first: {dashboard.reasons}. Use their Client Memory timeline before your next interaction.</p><p className="ai-disclaimer">Deterministic summary from saved database records. Gemini is used only for the three advisor-requested AI actions in Learning Hub, Partner Finder, and meeting-note organisation.</p></article>
      <div className="dashboard-columns">
        <section className="card client-memory-card"><div className="section-head"><div><p className="eyebrow">Client memory</p><h2>Clients that need context</h2></div><button className="text-action" onClick={() => onModal({ type: 'client' })}>Add client +</button></div><p className="section-helper">Click a client to view their running notes timeline, meetings, and actions.</p><div className="client-list">
          {priorityClients.map((client) => { const priority = priorityInfo(data, client); return <button className="client-row" key={client.id} onClick={() => onModal({ type: 'clientDetail', id: client.id })}><span className="client-initials">{initials(client.name)}</span><span><span className="client-name">{client.name}</span><span className="client-sub">{client.lifeEvent} · {daysBetween(client.lastContact)}d since contact</span></span><span className={`priority ${priority.label.toLowerCase()}`}>{priority.label}</span><span className="score-cell"><strong>{priority.score}</strong><small>priority</small></span><span className="chev">›</span></button>; })}
        </div></section>
        <section className="stacked-cards">
          <article className="card compact-card"><div className="section-head"><div><p className="eyebrow">Today</p><h2>Schedule</h2></div><button className="text-action" onClick={() => onModal({ type: 'meeting' })}>Add +</button></div><p className="section-helper compact-helper">Ticking a scheduled meeting contributes to Deadline Reliability in Growth.</p><div className="task-list">{meetings.map((meeting) => { const client = data.clients.find((item) => item.id === meeting.clientId); return <div className="task-row" key={meeting.id}><input className="check-input" type="checkbox" checked={meeting.done} onChange={(event) => toggleMeeting(meeting.id, event.target.checked)} /><div><div className="task-title">{formatTime(meeting.time)} · {client?.name || 'Client'}</div><div className="task-meta">{meeting.topic}</div></div><div className="task-actions">{meeting.teamsLink && <a className="tiny-btn" href={meeting.teamsLink} target="_blank" rel="noreferrer">Teams</a>}</div></div>; })}</div></article>
          <article className="card compact-card"><div className="section-head"><div><p className="eyebrow">Keep moving</p><h2>Follow-ups</h2></div><button className="text-action" onClick={() => onModal({ type: 'followup' })}>Add +</button></div><p className="section-helper compact-helper">Follow-up completion stays separate from Growth scoring.</p><div className="task-list">{followups.map((followup) => { const client = data.clients.find((item) => item.id === followup.clientId); const overdue = daysBetween(followup.dueDate) > 0; return <div className="task-row" key={followup.id}><input className="check-input" type="checkbox" checked={false} onChange={(event) => toggleFollowup(followup.id, event.target.checked)} /><div><div className="task-title">{followup.task}</div><div className={`task-meta ${overdue ? 'overdue' : ''}`}>{client?.name || 'Client'} · {overdue ? `Overdue ${daysBetween(followup.dueDate)}d` : `Due ${formatDate(followup.dueDate)}`}</div></div><div className="task-actions">{client && <a className="tiny-btn" href={`mailto:${client.email}?subject=${encodeURIComponent(`Following up: ${followup.task}`)}`}>Email</a>}</div></div>; })}</div></article>
        </section>
      </div>
      <section className="card expense-card"><div className="section-head"><div><p className="eyebrow">Activity costs</p><h2>Expense logger</h2></div><button className="btn btn-soft" onClick={() => onModal({ type: 'expense' })}>+ Log expense</button></div><div className="expense-layout"><div><span className="expense-total">RM {totalExpenses.toLocaleString('en-MY', { maximumFractionDigits: 0 })}</span><p>This month's advisor activity spend.</p></div><div className="expense-breakdown">{Object.entries(expenseBreakdown).map(([category, amount]) => <span key={category}>{category} · RM {amount.toLocaleString('en-MY', { maximumFractionDigits: 0 })}</span>)}</div></div></section>
    </section>
  );
}

function StatCard({ icon, tone, label, value }) {
  return <article className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><span>{label}</span><strong>{value}</strong></article>;
}

function LearningHub({ data, updateData, notify }) {
  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [selectedClient, setSelectedClient] = useState(data.clients[0]?.id || '');
  const [meetingBrief, setMeetingBrief] = useState(null);
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [loadingAction, setLoadingAction] = useState('');
  const hours = data.courses.filter((course) => course.completed).reduce((sum, course) => sum + course.hours, 0);
  const progress = Math.min(100, Math.round((hours / 35) * 100));
  const fallbackRecommendation = getLearningRecommendation(data);

  const generateCourseRecommendation = async () => {
    setLoadingAction('course');
    try {
      const result = await api.ai.courseRecommendation();
      setAiRecommendation(result.recommendation);
      notify('Gemini created a recommendation from saved Client Memory and the approved library.');
    } catch (error) {
      notify(error.message);
    } finally {
      setLoadingAction('');
    }
  };

  const generateBrief = async () => {
    if (!selectedClient) return;
    setLoadingAction('brief');
    try {
      const result = await api.ai.preMeetingBrief(selectedClient);
      setMeetingBrief(result.brief);
    } catch (error) {
      notify(error.message);
    } finally {
      setLoadingAction('');
    }
  };

  const ask = async () => {
    if (!question.trim()) { notify('Enter a question first.'); return; }
    setLoadingAction('ask');
    try {
      const result = await api.ai.learningQuestion(question);
      setAnswer(result);
    } catch (error) {
      notify(error.message);
    } finally {
      setLoadingAction('');
    }
  };

  const completeCourse = (courseId) => {
    updateData((next) => { const course = next.courses.find((item) => item.id === courseId); course.completed = true; return next; });
    const course = data.courses.find((item) => item.id === courseId);
    notify(`${course.hours} CPD hours added to your progress.`);
  };

  const recommendedCourse = aiRecommendation?.course;
  const relevantNames = aiRecommendation?.relevantClientIds?.map((id) => data.clients.find((client) => client.id === id)?.name).filter(Boolean) || [];

  return <section className="page active-page">
    <div className="page-heading split-heading"><div><p className="eyebrow">Outcome 2 · Continuous development</p><h1>Learning hub</h1><p>Pre-approved Malaysian CPD learning, grounded in your real client needs.</p></div><button className="btn btn-soft" onClick={() => setAskOpen(!askOpen)}>Ask Adviance <span>→</span></button></div>
    <section className="card cpd-card"><div className="section-head"><div><p className="eyebrow">Your personal progress</p><h2>CPD hours this year</h2></div><span className="cpd-pill">{hours} of 35 hours</span></div><div className="progress-track"><span className="progress-fill" style={{ width: `${progress}%` }} /></div><div className="progress-foot"><span>{hours} CPD hours completed</span><span>Annual target: 35 hours</span></div></section>
    <section className="learning-grid"><article className="card recommendation-card"><div className="ai-heading"><span className="ai-spark">✦</span><div><span className="ai-label">Gemini AI recommendation</span><h2>What to learn next</h2></div><button className="btn btn-soft btn-small" onClick={generateCourseRecommendation} disabled={loadingAction === 'course'}>{loadingAction === 'course' ? 'Thinking…' : 'Generate AI recommendation'}</button></div><div className="recommendation-copy"><strong>{recommendedCourse?.title || fallbackRecommendation.title}</strong><p>{aiRecommendation?.reason || fallbackRecommendation.copy}</p>{aiRecommendation?.nextStep && <p className="mini-ai-output"><strong>Next step:</strong> {aiRecommendation.nextStep}</p>}{relevantNames.length > 0 && <span className="recommendation-clients">Relevant saved clients: {relevantNames.join(', ')}</span>}{!aiRecommendation && fallbackRecommendation.clients.length > 0 && <span className="recommendation-clients">Relevant saved clients: {fallbackRecommendation.clients.join(', ')}</span>}</div></article><article className="card premeeting-card"><div className="section-head"><div><p className="eyebrow">Before you meet</p><h2>Pre-meeting brief</h2></div><span className="ai-label small">GEMINI</span></div><label className="field-label">Choose an upcoming client<select value={selectedClient} onChange={(event) => setSelectedClient(event.target.value)}>{data.clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label><button className="btn btn-primary btn-block" onClick={generateBrief} disabled={loadingAction === 'brief'}>{loadingAction === 'brief' ? 'Generating…' : 'Generate preparation brief'}</button>{meetingBrief && <div className="mini-ai-output"><strong>Client summary:</strong> {meetingBrief.clientSummary}<br /><strong>Talking points:</strong><ul>{meetingBrief.talkingPoints.map((item) => <li key={item}>{item}</li>)}</ul><strong>Questions to ask:</strong><ul>{meetingBrief.suggestedQuestions.map((item) => <li key={item}>{item}</li>)}</ul><small>{meetingBrief.disclaimer}</small></div>}</article></section>
    <section className="card course-library-card"><div className="section-head"><div><p className="eyebrow">Authorised learning only</p><h2>Pre-approved CPD library</h2></div><span className="library-note">Malaysia-specific modules</span></div><div className="course-grid">{data.courses.map((course) => <article className={`course-card ${course.completed ? 'complete' : ''}`} key={course.id}><div><span className="course-meta">{course.category}</span><h3>{course.title}</h3><p>{course.description}</p></div><div className="course-bottom"><span>{course.hours} CPD hours</span>{course.completed ? <span className="course-done">Completed</span> : <button className="btn btn-soft btn-small" onClick={() => completeCourse(course.id)}>Complete</button>}</div></article>)}</div></section>
    {askOpen && <section className="card ask-card"><div className="section-head"><div><p className="eyebrow">Quick knowledge brief</p><h2>Ask Adviance</h2></div><button className="text-action" onClick={() => setAskOpen(false)}>Close ×</button></div><p className="section-helper">Gemini uses only the pre-approved CPD library as learning context. The advisor should always review the response.</p><div className="ask-row"><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="e.g. Explain the difference between Takaful and conventional insurance" /><button className="btn btn-primary" onClick={ask} disabled={loadingAction === 'ask'}>{loadingAction === 'ask' ? 'Thinking…' : 'Ask'}</button></div>{answer && <div className="mini-ai-output">{answer.answer}{answer.course && <><br /><strong>Relevant course:</strong> {answer.course.title}</>}<br /><small>{answer.disclaimer}</small></div>}</section>}
  </section>;
}
function PartnerFinder({ data, updateData, onModal, notify }) {
  const [clientId, setClientId] = useState(data.clients[0]?.id || '');
  const [category, setCategory] = useState('Estate Planning');
  const [matchResult, setMatchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const client = data.clients.find((item) => item.id === clientId);
  const primaryMatch = matchResult?.matches?.[0];

  const findMatch = async () => {
    setLoading(true);
    try {
      const result = await api.ai.partnerMatch({ clientId, category });
      setMatchResult(result);
      notify('Gemini ranked authorised partners only.');
    } catch (error) {
      notify(error.message);
      setMatchResult(null);
    } finally {
      setLoading(false);
    }
  };

  return <section className="page active-page">
    <div className="page-heading"><p className="eyebrow">Outcome 3 · Ecosystem visibility</p><h1>Partner finder</h1><p>Match a client need only with authorised specialists in the selected category.</p></div>
    <section className="card match-control-card"><div className="match-fields"><label><span>Client</span><select value={clientId} onChange={(event) => setClientId(event.target.value)}>{data.clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Need category</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{NEED_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label></div><button className="btn btn-primary" onClick={findMatch} disabled={loading}>{loading ? 'Matching…' : '✦ Find authorised match'}</button><p className="section-helper">No free-text matching. Gemini receives only authorised partners within the selected category.</p></section>
    {primaryMatch && <section className="partner-match-result"><article className="partner-match-card"><span className="match-badge">Gemini authorised match · {primaryMatch.matchScore}/100</span><div className="partner-match-head"><div className="partner-profile"><span className="partner-avatar">{primaryMatch.partner.initials}</span><div><h2>{primaryMatch.partner.name}</h2><p>{primaryMatch.partner.expertise}</p></div></div><span className={`health-tag ${partnerHealth(primaryMatch.partner).toLowerCase()}`}>{partnerHealth(primaryMatch.partner)} relationship</span></div><p className="reason"><strong>Why this is a fit:</strong> {primaryMatch.reason}</p>{matchResult.matches.length > 1 && <p className="section-helper">Alternative authorised match: {matchResult.matches[1].partner.name} ({matchResult.matches[1].matchScore}/100).</p>}<button className="btn btn-primary" onClick={() => onModal({ type: 'intro', clientId: client.id, partnerId: primaryMatch.partner.id, introDraft: matchResult.introductionDraft })}>Review AI-drafted introduction</button><p className="ai-disclaimer">{matchResult.disclaimer}</p></article></section>}
    <section className="partner-columns"><article className="card"><div className="section-head"><div><p className="eyebrow">Authorised ecosystem</p><h2>Partner directory</h2></div><span className="library-note">Health based on referral recency</span></div><div className="partner-directory">{data.partners.map((partner) => <article className="partner-card" key={partner.id}><span className="partner-avatar">{partner.initials}</span><div><h3>{partner.name}</h3><p>{partner.expertise}</p><span className="partner-tag">{partner.category}</span></div><span className={`health-tag ${partnerHealth(partner).toLowerCase()}`}>{partnerHealth(partner)}</span></article>)}</div></article><article className="card referral-card"><div className="section-head"><div><p className="eyebrow">Relationship history</p><h2>Referral log</h2></div><button className="text-action" onClick={() => onModal({ type: 'referral' })}>Add referral +</button></div><ReferralLog data={data} /></article></section>
  </section>;
}
function ReferralLog({ data }) {
  if (!data.referrals.length) return <p className="section-helper">No referrals logged yet.</p>;
  return <div className="referral-log">{[...data.referrals].sort((a, b) => b.date.localeCompare(a.date)).map((referral) => { const client = data.clients.find((item) => item.id === referral.clientId); const partner = data.partners.find((item) => item.id === referral.partnerId); return <div className="referral-row" key={referral.id}><div><strong>{client?.name || 'Client'} → {partner?.name || 'Partner'}</strong><span>{referral.category} · {formatDate(referral.date)}</span></div><span className={`status-badge ${referral.outcome.toLowerCase().replace(' ', '-')}`}>{referral.outcome}</span></div>; })}</div>;
}

function Growth({ data }) {
  const metrics = practiceMetrics(data);
  const circumference = 364.42;
  const dashOffset = circumference * (1 - metrics.practiceScore / 100);
  const metricCards = [
    ['Client engagement', metrics.clientEngagement, `${metrics.engaged} of ${data.clients.length} clients have logged activity`, 'green'],
    ['Deadline reliability', metrics.deadlineReliability, `${data.meetings.filter((meeting) => meeting.done).length} of ${data.meetings.length} meetings ticked complete`, 'amber'],
    ['Partner activity', metrics.partnerActivity, `${metrics.activePartners} active partners · ${metrics.successfulReferrals} successful referrals`, 'green'],
  ];
  return <section className="page active-page growth-page">
    <div className="page-heading"><p className="eyebrow">Practice intelligence</p><h1>Growth</h1><p>Transparent scores built from saved activity — no invisible calculations.</p></div>
    <section className="growth-hero card"><div className="score-orbit"><svg viewBox="0 0 144 144" aria-label={`Practice score ${metrics.practiceScore} of 100`}><circle cx="72" cy="72" r="58" className="orbit-bg" /><circle cx="72" cy="72" r="58" className="orbit-progress" style={{ strokeDasharray: circumference, strokeDashoffset: dashOffset }} /></svg><div className="orbit-score"><strong>{metrics.practiceScore}</strong><span>practice score</span></div></div><div><p className="eyebrow">Combined practice score</p><h2>Your momentum is visible.</h2><p>You have {data.clients.length} saved clients and {metrics.activePartners} active partner relationships. Client volume and partner activity currently create a practice score of {metrics.practiceScore}.</p></div></section>
    <section className="growth-metrics">{metricCards.map(([name, score, copy, tone]) => <article className="growth-metric" key={name}><div className="metric-top"><span className="metric-icon">{name === 'Client engagement' ? '♧' : name === 'Deadline reliability' ? '▣' : '⌘'}</span><span className="metric-name">{name}</span></div><div className="metric-number">{score}</div><div className={`mini-progress ${tone}`}><span style={{ width: `${score}%` }} /></div><p className="section-helper">{copy}</p></article>)}</section>
    <section className="growth-columns"><article className="card"><div className="section-head"><div><p className="eyebrow">Client activity</p><h2>Client engagement</h2></div><span className="metric-tag">Notes + completed meetings</span></div><p className="section-helper">A client counts as engaged when they have a logged note or a completed meeting in the current review period.</p><div className="engagement-list">{data.clients.map((client) => { const active = client.notes.length > 0 || data.meetings.some((meeting) => meeting.clientId === client.id && meeting.done); return <div className="engagement-row" key={client.id}><span>{client.name}</span><strong className={active ? 'engaged' : 'not-engaged'}>{active ? 'Engaged' : 'No activity'}</strong></div>; })}</div></article><article className="card score-rules-card"><div className="section-head"><div><p className="eyebrow">How this is calculated</p><h2>Score rules</h2></div></div><div className="rule-list"><div><span className="rule-number">1</span><p><strong>Client engagement</strong> uses clients with a note or ticked meeting.</p></div><div><span className="rule-number">2</span><p><strong>Deadline reliability</strong> uses schedule ticks only.</p></div><div><span className="rule-number">3</span><p><strong>Partner activity</strong> uses active partners and successful referrals.</p></div><div><span className="rule-number">4</span><p><strong>Practice score</strong> combines client volume and partner activity.</p></div></div></article></section>
  </section>;
}

function ModalHost({ modal, data, updateData, close, notify }) {
  const client = modal.id ? data.clients.find((item) => item.id === modal.id) : null;
  const [noteDraft, setNoteDraft] = useState('');
  const [noteAnalysis, setNoteAnalysis] = useState(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const addClient = (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const note = form.get('note').trim(); updateData((next) => { next.clients.push({ id: makeId('c'), name: form.get('name').trim(), email: form.get('email').trim(), lastContact: form.get('lastContact'), portfolioValue: Number(form.get('portfolioValue') || 0), portfolioChange: Number(form.get('portfolioChange') || 0), lifeEvent: form.get('lifeEvent'), notes: note ? [{ date: DEMO_DATE, text: note }] : [] }); return next; }); close(); notify('Client saved to Client Memory.'); };
  const addMeeting = (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); updateData((next) => { next.meetings.push({ id: makeId('m'), clientId: form.get('clientId'), date: form.get('date'), time: form.get('time'), topic: form.get('topic').trim(), teamsLink: form.get('teamsLink').trim(), done: false }); return next; }); close(); notify('Meeting added to schedule.'); };
  const addFollowup = (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); updateData((next) => { next.followups.push({ id: makeId('f'), clientId: form.get('clientId'), dueDate: form.get('dueDate'), task: form.get('task').trim(), done: false }); return next; }); close(); notify('Follow-up added.'); };
  const addExpense = (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); updateData((next) => { next.expenses.push({ id: makeId('e'), category: form.get('category'), amount: Number(form.get('amount')), description: form.get('description').trim() }); return next; }); close(); notify('Expense logged.'); };
  const addReferral = (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); updateData((next) => { next.referrals.push({ id: makeId('r'), clientId: form.get('clientId'), partnerId: form.get('partnerId'), category: form.get('category'), date: form.get('date'), outcome: form.get('outcome') }); const partner = next.partners.find((item) => item.id === form.get('partnerId')); if (partner) partner.lastReferral = form.get('date'); return next; }); close(); notify('Referral logged and partner health updated.'); };
  const organiseNote = async () => { if (!noteDraft.trim()) { notify('Write meeting notes before using Gemini.'); return; } setNoteLoading(true); try { const result = await api.ai.organizeMeetingNotes({ clientId: modal.id, rawNotes: noteDraft }); setNoteAnalysis(result.analysis); } catch (error) { notify(error.message); } finally { setNoteLoading(false); } };
  const addNote = async (event) => { event.preventDefault(); const text = noteDraft.trim(); if (!text) { notify('A note cannot be empty.'); return; } try { await api.addClientNote(modal.id, text, DEMO_DATE); updateData((next) => { const selected = next.clients.find((item) => item.id === modal.id); selected.notes.push({ date: DEMO_DATE, text }); selected.lastContact = DEMO_DATE; return next; }); close(); notify('New context saved to Client Memory in the backend database.'); } catch (error) { notify(error.message); } };

  let content = null;
  if (modal.type === 'client') content = <form onSubmit={addClient}><ModalHead eyebrow="Client memory" title="Add client" close={close} /><div className="form-grid two"><Field label="Name"><input name="name" required placeholder="e.g. Nur Aisyah" /></Field><Field label="Email"><input name="email" type="email" required placeholder="client@email.com" /></Field><Field label="Portfolio value (RM)"><input name="portfolioValue" type="number" min="0" placeholder="250000" /></Field><Field label="Portfolio change (%)"><input name="portfolioChange" type="number" step="0.1" placeholder="-3.5" /></Field><Field label="Last contact date"><input name="lastContact" type="date" defaultValue={DEMO_DATE} required /></Field><Field label="Life event / core need"><select name="lifeEvent">{CLIENT_NEEDS.map((item) => <option key={item}>{item}</option>)}</select></Field></div><Field label="Initial advisor note"><textarea name="note" rows="4" placeholder="Capture context, concern, or agreed next action..." /></Field><button className="btn btn-primary btn-block" type="submit">Save to Client Memory</button></form>;
  if (modal.type === 'meeting') content = <form onSubmit={addMeeting}><ModalHead eyebrow="Advisor schedule" title="Add meeting" close={close} /><div className="form-grid two"><Field label="Client"><ClientSelect clients={data.clients} name="clientId" /></Field><Field label="Meeting date"><input name="date" type="date" defaultValue={DEMO_DATE} required /></Field><Field label="Meeting time"><input name="time" type="time" defaultValue="10:00" required /></Field><Field label="Topic"><input name="topic" required placeholder="Portfolio review" /></Field></div><Field label="Microsoft Teams link (optional)"><input name="teamsLink" type="url" placeholder="https://teams.microsoft.com/..." /></Field><button className="btn btn-primary btn-block" type="submit">Add scheduled meeting</button></form>;
  if (modal.type === 'followup') content = <form onSubmit={addFollowup}><ModalHead eyebrow="Client action" title="Add follow-up" close={close} /><div className="form-grid two"><Field label="Client"><ClientSelect clients={data.clients} name="clientId" /></Field><Field label="Due date"><input name="dueDate" type="date" defaultValue={DEMO_DATE} required /></Field></div><Field label="Task"><input name="task" required placeholder="e.g. Send estate planning summary" /></Field><button className="btn btn-primary btn-block" type="submit">Add follow-up</button></form>;
  if (modal.type === 'expense') content = <form onSubmit={addExpense}><ModalHead eyebrow="Activity costs" title="Log expense" close={close} /><div className="form-grid two"><Field label="Category"><select name="category"><option>Client meals</option><option>Travel</option><option>Learning</option><option>General activity</option></select></Field><Field label="Amount (RM)"><input name="amount" type="number" min="0" step="0.01" required /></Field></div><Field label="Description"><input name="description" required placeholder="e.g. Taxi to client review" /></Field><button className="btn btn-primary btn-block" type="submit">Save expense</button></form>;
  if (modal.type === 'referral') content = <form onSubmit={addReferral}><ModalHead eyebrow="Relationship history" title="Add referral" close={close} /><div className="form-grid two"><Field label="Client"><ClientSelect clients={data.clients} name="clientId" /></Field><Field label="Partner"><select name="partnerId">{data.partners.map((partner) => <option value={partner.id} key={partner.id}>{partner.name}</option>)}</select></Field><Field label="Need category"><select name="category">{NEED_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Outcome"><select name="outcome"><option>Pending</option><option>Successful</option><option>No Response</option></select></Field></div><Field label="Date"><input name="date" type="date" defaultValue={DEMO_DATE} required /></Field><button className="btn btn-primary btn-block" type="submit">Save referral</button></form>;
  if (modal.type === 'clientDetail' && client) {
    const priority = priorityInfo(data, client);
    const meetings = data.meetings.filter((item) => item.clientId === client.id);
    const openFollowups = data.followups.filter((item) => item.clientId === client.id && !item.done).length;
    const timeline = [...client.notes.map((item) => ({ ...item, type: 'Advisor note' })), ...meetings.map((item) => ({ date: item.date, text: `Meeting ${item.done ? 'completed' : 'scheduled'}: ${item.topic} (${formatTime(item.time)})`, type: 'Meeting' }))].sort((a, b) => b.date.localeCompare(a.date));
    content = <div><ModalHead eyebrow="Client memory" title={client.name} close={close} /><p className="detail-subtitle">{client.lifeEvent} · {client.email}</p><div className="detail-actions"><a className="tiny-btn" href={`mailto:${client.email}?subject=${encodeURIComponent('Checking in')}`}>Email client</a></div><div className="detail-kpis"><div><span>Priority</span><strong>{priority.score}/100 · {priority.label}</strong></div><div><span>Portfolio</span><strong>RM {Number(client.portfolioValue).toLocaleString('en-MY')}</strong></div><div><span>Open follow-ups</span><strong>{openFollowups}</strong></div></div><div className="timeline-title">Memory timeline</div><div className="timeline">{timeline.length ? timeline.map((item, index) => <div className="timeline-item" key={`${item.type}-${index}`}><span>{formatDate(item.date)} · {item.type}</span><p>{item.text}</p></div>) : <p className="section-helper">No memory entries yet.</p>}</div><form className="note-form" onSubmit={addNote}><Field label="Add a new meeting note"><textarea value={noteDraft} onChange={(event) => { setNoteDraft(event.target.value); setNoteAnalysis(null); }} rows="4" placeholder="Capture a concern, life change, key discussion, or agreed action..." /></Field><div className="detail-actions"><button className="btn btn-soft" type="button" onClick={organiseNote} disabled={noteLoading}>{noteLoading ? 'Organising…' : '✦ Organise with Gemini'}</button><button className="btn btn-primary" type="submit">Save note to Client Memory</button></div>{noteAnalysis && <div className="mini-ai-output"><strong>Meeting summary:</strong> {noteAnalysis.summary}<br /><strong>Concerns:</strong><ul>{(Array.isArray(noteAnalysis.clientConcerns) ? noteAnalysis.clientConcerns : []).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul><strong>Action items to review:</strong><ul>{(Array.isArray(noteAnalysis.actionItems) ? noteAnalysis.actionItems : []).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul><small>{noteAnalysis.disclaimer}</small></div>}</form></div>;
  }
  if (modal.type === 'intro') {
    const introClient = data.clients.find((item) => item.id === modal.clientId);
    const partner = data.partners.find((item) => item.id === modal.partnerId);
    const draft = modal.introDraft || `Subject: Introduction — ${introClient.name}\n\nHi ${partner.name},\n\nI would like to introduce ${introClient.name}, who is currently exploring ${introClient.lifeEvent.toLowerCase()}. Based on their situation, I believe your expertise in ${partner.expertise.toLowerCase()} could be highly relevant.\n\n${introClient.name}, ${partner.name} is an authorised specialist in our partner ecosystem.\n\nI will leave you both to connect directly.\n\nKind regards,\nAhmad Rahman`;
    content = <div><ModalHead eyebrow="One-click introduction" title="Draft ready to review" close={close} /><p className="intro-preview">This message uses saved client and partner names, but the advisor retains full control before sending.</p><textarea className="intro-textarea" defaultValue={draft} /><div className="detail-actions"><button className="btn btn-soft" onClick={async () => { try { if (!navigator.clipboard) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(draft); notify('Introduction copied to clipboard.'); } catch { notify('Copy is unavailable in this browser preview.'); } }}>Copy draft</button><a className="btn btn-primary" href={`mailto:${partner.email}?subject=${encodeURIComponent(`Introduction — ${introClient.name}`)}&body=${encodeURIComponent(draft)}`}>Open email draft</a></div></div>;
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={close}><div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>{content}</div></div>;
}

function ModalHead({ eyebrow, title, close }) { return <div className="modal-head"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button type="button" className="close-modal" onClick={close}>×</button></div>; }
function Field({ label, children }) { return <label className="field-label">{label}{children}</label>; }
function ClientSelect({ clients, name }) { return <select name={name} required>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>; }

export default App;
