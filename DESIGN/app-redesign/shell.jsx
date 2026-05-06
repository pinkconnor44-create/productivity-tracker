// App shell — left nav + tab switching
const SHT = window.T;
const SHD = window.AppData;

function NavItem({ icon, label, badge, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      width: '100%', padding: '10px 14px',
      background: active ? 'rgba(139,92,246,0.16)' : 'transparent',
      border: active ? '1px solid rgba(139,92,246,0.30)' : '1px solid transparent',
      borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
      color: active ? SHT.text : SHT.textMuted,
      textAlign: 'left',
      transition: 'all .15s',
    }}>
      <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 600 : 500, letterSpacing: '-0.005em' }}>{label}</span>
      {badge != null && (
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: '1px 7px', borderRadius: 999,
          background: active ? SHT.accentSolid : 'rgba(139,141,163,0.14)',
          color: active ? '#fff' : SHT.textMuted,
          fontFeatureSettings: '"tnum"',
        }}>{badge}</span>
      )}
    </button>
  );
}

function Sidebar({ tab, setTab }) {
  const todayScore = SHD.scoreForDate(SHD.TODAY);
  const taskOverdue = SHD.TASKS.filter(t => !t.recurringType && !t.completed && t.dueDate && t.dueDate < SHD.TODAY).length;
  const habitsActive = SHD.habitsForDate(SHD.TODAY).length;
  const habitsDone = SHD.habitsForDate(SHD.TODAY).filter(h => SHD.isHabitDone(h, SHD.TODAY)).length;

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: 'rgba(11,19,38,0.65)',
      borderRight: '1px solid rgba(139,92,246,0.12)',
      padding: '20px 14px',
      display: 'flex', flexDirection: 'column', gap: 24,
      position: 'sticky', top: 0, height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: SHT.accentGrad,
          boxShadow: '0 0 16px rgba(139,92,246,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: SHT.display, fontWeight: 700, color: '#fff', fontSize: 14,
        }}>L</div>
        <div>
          <div style={{ fontFamily: SHT.display, fontSize: 14, fontWeight: 600, color: SHT.text, letterSpacing: '-0.01em' }}>Lumina</div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: SHT.textDim, textTransform: 'uppercase' }}>Productivity</div>
        </div>
      </div>

      {/* Today summary */}
      <div style={{
        padding: '12px 14px', borderRadius: 12,
        background: SHT.panelLow, border: SHT.borderSoft,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: SHT.textDim, textTransform: 'uppercase', marginBottom: 6 }}>Today</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontFamily: SHT.display, fontSize: 28, fontWeight: 600, color: SHD.scoreColor(todayScore?.pct), letterSpacing: '-0.02em', lineHeight: 1 }}>
            {todayScore?.pct ?? 0}
          </span>
          <span style={{ fontSize: 12, color: SHT.textMuted, fontWeight: 600 }}>%</span>
        </div>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${todayScore?.pct ?? 0}%`, background: SHD.scoreColor(todayScore?.pct), borderRadius: 2 }} />
        </div>
        <div style={{ fontSize: 11, color: SHT.textDim, marginTop: 8 }}>Wed · May 6</div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: SHT.textDim, textTransform: 'uppercase', padding: '0 14px 6px' }}>Daily</div>
        <NavItem
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>}
          label="Tasks" badge={taskOverdue > 0 ? taskOverdue : null} active={tab === 'tasks'} onClick={() => setTab('tasks')} />
        <NavItem
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6m0 0c-3 0-5 3-5 6 0 4 3 8 5 8s5-4 5-8c0-3-2-6-5-6z"/></svg>}
          label="Habits" badge={`${habitsDone}/${habitsActive}`} active={tab === 'habits'} onClick={() => setTab('habits')} />
        <NavItem
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/><path d="M3 12h2M19 12h2M12 3v2M12 19v2"/></svg>}
          label="Lifts" active={tab === 'lifts'} onClick={() => setTab('lifts')} />

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: SHT.textDim, textTransform: 'uppercase', padding: '16px 14px 6px' }}>Insights</div>
        <NavItem
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-7"/></svg>}
          label="Stats" active={tab === 'stats'} onClick={() => setTab('stats')} />
        <NavItem
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>}
          label="Calendar" active={false} onClick={() => {}} />
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 14px', borderTop: SHT.borderSoft, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'linear-gradient(135deg, #06b6d4, #ec4899)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: SHT.display, fontWeight: 600, color: '#fff', fontSize: 12,
        }}>JC</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: SHT.text }}>Jordan Chen</div>
          <div style={{ fontSize: 10, color: SHT.textDim }}>jordan@lumina.app</div>
        </div>
      </div>
    </aside>
  );
}

function App() {
  const [tab, setTab] = React.useState('tasks');
  const View = ({
    tasks: window.TasksView,
    habits: window.HabitsView,
    lifts: window.LiftsView,
    stats: window.StatsView,
  }[tab]);
  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: SHT.bgGrad,
      color: SHT.text,
      fontFamily: SHT.body,
    }}>
      <Sidebar tab={tab} setTab={setTab} />
      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1280, margin: '0 auto' }}>
        <div data-screen-label={tab[0].toUpperCase() + tab.slice(1)}>
          <View />
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
