import { ReactNode } from 'react';

export type AppTab = 'dashboard' | 'summary' | 'settings' | 'timeline';

interface AppShellProps {
  activeTab: AppTab;
  children: ReactNode;
  onLock: () => void;
  onTabChange: (tab: AppTab) => void;
}

const navItems: { label: string; tab: AppTab }[] = [
  { label: '📋 Dashboard', tab: 'dashboard' },
  { label: '📜 Activity', tab: 'timeline' },
  { label: '📈 Summaries', tab: 'summary' },
  { label: '⚙️ Settings', tab: 'settings' },
];

export const AppShell = ({ activeTab, children, onLock, onTabChange }: AppShellProps) => {
  return (
    <div className="app-container">
      <div className="main-content">
        <nav className="top-nav">
          <div className="brand">
            <span style={{ fontSize: '22px' }}>🛡️</span>
            <h1>Memor</h1>
          </div>

          <div className="nav-links">
            {navItems.map((item) => (
              <button
                key={item.tab}
                type="button"
                className={`nav-btn ${activeTab === item.tab ? 'active' : ''}`}
                onClick={() => onTabChange(item.tab)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onLock}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              🔒 Lock
            </button>
          </div>
        </nav>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>{children}</div>
      </div>
    </div>
  );
};
