/**
 * AppShell — the Cradle signature move rendered live.
 *
 * The outer frame is a single `bg-sidebar` sheet. The content is a rounded,
 * inset "floating card" that sits on a 4-8px sidebar-colored gutter, defined
 * by a subtle 1px oklch ring shadow rather than an elevation drop. Chrome
 * regions (sidebar / header / footer / right aside) all share the sidebar bg;
 * the content card is the *only* thing on `--color-surface`.
 *
 * This is Cradle's fingerprint — every route lives inside this shell.
 */

import type { Lang } from '../i18n'
import { t } from '../i18n'

interface AppShellProps {
  lang: Lang
}

function SidebarRow({ label, active, dot }: { label: string, active?: boolean, dot?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 24,
      padding: '0 8px',
      borderRadius: 6,
      background: active ? 'var(--color-sidebar-fill)' : 'transparent',
      fontFamily: 'var(--font-sans)',
      fontSize: 12,
      color: active ? 'var(--color-neutral-9)' : 'var(--color-sidebar-foreground)',
    }}
    >
      <span style={{
        width: 12,
        height: 12,
        borderRadius: 3,
        background: dot ?? 'var(--color-neutral-4)',
        flexShrink: 0,
      }}
      />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

export default function AppShell({ lang }: AppShellProps) {
  return (
    <section className="section">
      <div className="section-head">
        <p className="section-num">{t('shellNum', lang)}</p>
        <h2 className="section-title">{t('shellTitle', lang)}</h2>
        <p className="section-lede">{t('shellLede', lang)}</p>
      </div>

      {/* Live miniature of the app shell */}
      <div style={{
        height: 420,
        background: 'var(--color-sidebar)',
        borderRadius: 12,
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
        display: 'flex',
        position: 'relative',
      }}
      >
        {/* Sidebar column */}
        <aside style={{
          width: 168,
          padding: '32px 8px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flexShrink: 0,
        }}
        >
          <div style={{ padding: '0 8px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-sidebar-foreground)', letterSpacing: '0.04em' }}>
            WORKSPACES
          </div>
          <SidebarRow label="Personal" active dot="var(--color-accent)" />
          <SidebarRow label="Cradle" dot="var(--color-accent-scope)" />
          <SidebarRow label="Studio" dot="var(--color-accent-agent)" />
          <div style={{ height: 8 }} />
          <div style={{ padding: '0 8px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-sidebar-foreground)', letterSpacing: '0.04em' }}>
            AGENTS
          </div>
          <SidebarRow label="Research bot" dot="var(--color-accent-session)" />
          <SidebarRow label="PR triager" dot="var(--color-accent-summary)" />
        </aside>

        {/* Content column — the floating inset card */}
        <div style={{
          flex: 1,
          margin: '4px 8px 4px 0',
          borderRadius: 10,
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 10,
        }}
        >
          {/* Header (chrome bg, matched to sidebar) */}
          <div style={{
            height: 36,
            padding: '0 12px',
            borderBottom: '1px solid var(--color-border-content)',
            background: 'var(--color-sidebar)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 9999, background: 'var(--color-accent-scope)' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: 'var(--color-neutral-9)' }}>
              Design system audit
            </span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-neutral-6)' }}>2 tabs</span>
          </div>

          {/* Body */}
          <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ height: 12, width: 140, borderRadius: 4, background: 'var(--color-neutral-3)' }} />
            <div style={{ height: 10, width: '75%', borderRadius: 3, background: 'var(--color-neutral-3)' }} />
            <div style={{ height: 10, width: '55%', borderRadius: 3, background: 'var(--color-neutral-3)' }} />
            <div style={{
              marginTop: 8,
              height: 60,
              borderRadius: 8,
              background: 'var(--color-surface-inset)',
              boxShadow: 'var(--shadow-inset-ring)',
              padding: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--color-fill)' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ height: 8, width: '70%', borderRadius: 2, background: 'var(--color-neutral-4)' }} />
                <div style={{ height: 7, width: '50%', borderRadius: 2, background: 'var(--color-neutral-4)' }} />
              </div>
            </div>
          </div>

          {/* Footer (chrome bg) */}
          <div style={{
            height: 28,
            padding: '0 12px',
            borderTop: '1px solid var(--color-border-content)',
            background: 'var(--color-sidebar)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-neutral-6)' }}>ready</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-neutral-6)' }}>⌘K</span>
          </div>
        </div>

        {/* Right aside (chrome bg — a separate sidebar column) */}
        <aside style={{
          width: 128,
          padding: '32px 8px 8px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
        >
          <div style={{ padding: '0 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-sidebar-foreground)', letterSpacing: '0.04em' }}>
            CONTEXT
          </div>
          <div style={{
            padding: 8,
            borderRadius: 8,
            background: 'var(--color-sidebar-fill)',
          }}
          >
            <div style={{ height: 8, width: '80%', borderRadius: 2, background: 'var(--color-neutral-4)', marginBottom: 6 }} />
            <div style={{ height: 6, width: '60%', borderRadius: 2, background: 'var(--color-neutral-4)' }} />
          </div>
        </aside>

        {/* Labels — annotations on the miniature */}
        <div style={{
          position: 'absolute',
          top: 8,
          left: 12,
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--color-neutral-6)',
          letterSpacing: '0.04em',
        }}
        >
          sidebar · bg-sidebar
        </div>
        <div style={{
          position: 'absolute',
          top: 8,
          left: 190,
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--color-neutral-6)',
          letterSpacing: '0.04em',
        }}
        >
          content · bg-surface · rounded-xl · shadow-sm
        </div>
      </div>

      {/* Explanation strip */}
      <div style={{
        marginTop: 24,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
      }}
      >
        <div style={{ padding: 16, background: 'var(--color-neutral-2)', borderRadius: 10 }}>
          <p style={{ margin: '0 0 6px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--color-accent)', letterSpacing: '0.04em' }}>THE MOVE</p>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-neutral-9)' }}>
            {t('shellMove1Title', lang)}
          </p>
          <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-neutral-6)', lineHeight: 1.5 }}>
            {t('shellMove1Body', lang)}
          </p>
        </div>
        <div style={{ padding: 16, background: 'var(--color-neutral-2)', borderRadius: 10 }}>
          <p style={{ margin: '0 0 6px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--color-accent)', letterSpacing: '0.04em' }}>TWO-TONE</p>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-neutral-9)' }}>
            {t('shellMove2Title', lang)}
          </p>
          <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-neutral-6)', lineHeight: 1.5 }}>
            {t('shellMove2Body', lang)}
          </p>
        </div>
        <div style={{ padding: 16, background: 'var(--color-neutral-2)', borderRadius: 10 }}>
          <p style={{ margin: '0 0 6px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--color-accent)', letterSpacing: '0.04em' }}>NO ELEVATION</p>
          <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'var(--color-neutral-9)' }}>
            {t('shellMove3Title', lang)}
          </p>
          <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-neutral-6)', lineHeight: 1.5 }}>
            {t('shellMove3Body', lang)}
          </p>
        </div>
      </div>
    </section>
  )
}
