// Shared Theme-A primitives — Refined Lumina
// All views import from here. Keep visual vocabulary consistent.

const T = {
  // Colors
  bg:           '#0b1326',
  bgGrad:       'radial-gradient(ellipse at top left, rgba(139,92,246,0.10) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(6,182,212,0.08) 0%, transparent 50%), #0b1326',
  panel:        'rgba(23,31,51,0.85)',
  panelHi:      'rgba(31,40,67,0.95)',
  panelLow:     'rgba(15,21,38,0.6)',
  border:       '1px solid rgba(139,92,246,0.18)',
  borderSoft:   '1px solid rgba(139,92,246,0.10)',
  borderHair:   'rgba(139,92,246,0.10)',
  inset:        'inset 0 1px 0 rgba(255,255,255,0.04)',
  shadow:       '0 8px 32px rgba(0,0,0,0.4)',

  text:         '#dae2fd',
  textMuted:    '#8b8da3',
  textDim:      '#6b7088',
  textVDim:     '#5c6273',

  accent:       '#a78bfa',
  accentSolid:  '#7c3aed',
  accentGrad:   'linear-gradient(135deg, #7c3aed, #06b6d4)',
  accentGlow:   '0 0 12px rgba(139,92,246,0.4)',

  // Type
  display:      'Space Grotesk, sans-serif',
  body:         'Manrope, sans-serif',
};

window.T = T;

// ── PageHeader ───────────────────────────────────────────────────────
// Eyebrow + display title + sub. Used at the top of every view.
function PageHeader({ eyebrow, title, sub, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: T.accent, textTransform: 'uppercase', marginBottom: 6 }}>{eyebrow}</div>
        <h1 style={{ fontFamily: T.display, fontSize: 36, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: T.text, lineHeight: 1.1 }}>
          {title}
        </h1>
        {sub && <div style={{ fontSize: 13, color: T.textMuted, marginTop: 8, maxWidth: 540, lineHeight: 1.5 }}>{sub}</div>}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

// ── StatCard ─────────────────────────────────────────────────────────
// Hero stat with eyebrow + huge number + thin colored bar.
function StatCard({ label, value, suffix, sub, color, barPct }) {
  const c = color ?? T.accent;
  return (
    <div style={{
      flex: 1, padding: '14px 16px', borderRadius: 12,
      background: T.panel, border: T.border,
      display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: T.inset,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: T.textMuted, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: T.display, fontSize: 28, fontWeight: 600, color: value === '—' || value == null ? T.textVDim : T.text, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {value ?? '—'}
        </span>
        {suffix && value != null && value !== '—' && <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>{suffix}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: T.textDim }}>{sub}</div>}
      {barPct != null && (
        <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, barPct)}%`, background: c, borderRadius: 2 }} />
        </div>
      )}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────
// Standard panel container.
function Card({ children, style, padding = 0 }) {
  return (
    <div style={{
      background: T.panel, border: T.border, borderRadius: 16,
      boxShadow: `${T.inset}, ${T.shadow}`,
      overflow: 'hidden',
      padding,
      ...style,
    }}>{children}</div>
  );
}

// ── Section ──────────────────────────────────────────────────────────
// "● LABEL · 3/5" header above a list/card.
function Section({ dot, color, label, count, total, right, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingLeft: 2 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot ?? color ?? T.accent, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: color ?? T.accent, textTransform: 'uppercase' }}>{label}</span>
        {total != null && (
          <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, fontFeatureSettings: '"tnum"', marginLeft: 'auto' }}>
            {count}/{total}
          </span>
        )}
        {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
      </div>
      {children}
    </div>
  );
}

// ── KindChip ─────────────────────────────────────────────────────────
function KindChip({ kind }) {
  const c = window.AppData.KIND_COLORS[kind];
  if (!c) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 999,
      background: c.bg, color: c.fg,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot }} />
      {c.label}
    </span>
  );
}

// ── WeightChip ───────────────────────────────────────────────────────
function WeightChip({ w }) {
  if (!w || w === 1) return null;
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 999,
      background: window.AppData.W_BG[w],
      color: window.AppData.W_COLOR[w],
      fontSize: 10, fontWeight: 700,
    }}>{window.AppData.W_LABEL[w]}</span>
  );
}

// ── Checkbox ─────────────────────────────────────────────────────────
function Checkbox({ checked, onClick, color = '#10b981', skipped, kind }) {
  const k = kind ? window.AppData.KIND_COLORS[kind]?.dot : null;
  const ringColor = k ?? T.accent;
  return (
    <button onClick={onClick} disabled={skipped} style={{
      width: 18, height: 18, borderRadius: 6, padding: 0, cursor: skipped ? 'not-allowed' : 'pointer',
      border: skipped ? '2px solid rgba(245,158,11,0.4)'
        : checked ? 'none'
        : `2px solid ${ringColor}66`,
      background: skipped ? 'rgba(245,158,11,0.15)'
        : checked ? color
        : 'transparent',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      transition: 'all .15s',
    }}>
      {checked && !skipped && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// ── Toolbar buttons ──────────────────────────────────────────────────
function NavBtn({ children, active, onClick, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      padding: '6px 12px', fontSize: 12, fontWeight: 600,
      background: active ? T.accentGrad : T.panel,
      border: T.border, color: active ? '#fff' : T.textMuted,
      borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
      boxShadow: active ? T.accentGlow : 'none',
      minWidth: children === '←' || children === '→' ? 32 : 'auto',
    }}>{children}</button>
  );
}

// ── Eyebrow (small label) ────────────────────────────────────────────
function Eyebrow({ children, color }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
      color: color ?? T.textMuted, textTransform: 'uppercase',
    }}>{children}</div>
  );
}

// ── HairlineDivider ──────────────────────────────────────────────────
function Hairline() {
  return <div style={{ height: 1, background: T.borderHair, width: '100%' }} />;
}

window.Theme = { PageHeader, StatCard, Card, Section, KindChip, WeightChip, Checkbox, NavBtn, Eyebrow, Hairline };
