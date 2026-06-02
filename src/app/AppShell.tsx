import { ReactNode } from 'react';
import { Menu, Button, Icon } from 'semantic-ui-react';

export type AppTab = 'dashboard' | 'summary' | 'settings' | 'timeline';

interface AppShellProps {
  activeTab: AppTab;
  children: ReactNode;
  onLock: () => void;
  onTabChange: (tab: AppTab) => void;
}

const navItems: { icon: string; label: string; tab: AppTab }[] = [
  { icon: 'clipboard list', label: 'Dashboard', tab: 'dashboard' },
  { icon: 'history', label: 'Activity', tab: 'timeline' },
  { icon: 'chart line', label: 'Summaries', tab: 'summary' },
  { icon: 'setting', label: 'Settings', tab: 'settings' },
];

export const AppShell = ({ activeTab, children, onLock, onTabChange }: AppShellProps) => {
  return (
    <div className="app-container">
      <div className="main-content">
        <Menu
          borderless
          className="top-nav"
          style={{
            margin: 0,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.5)',
            borderBottom: '1px solid var(--panel-border)',
            borderRadius: 0,
            height: '64px',
          }}
        >
          <Menu.Item
            header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'transparent',
              padding: 0,
            }}
          >
            <span style={{ fontSize: '22px' }}>🛡️</span>
            <span
              style={{
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                background: 'linear-gradient(135deg, #a5b4fc 0%, #6366f1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Memor
            </span>
          </Menu.Item>

          <Menu.Menu
            position="right"
            style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              {navItems.map((item) => (
                <Button
                  key={item.tab}
                  type="button"
                  onClick={() => onTabChange(item.tab)}
                  style={{
                    color: activeTab === item.tab ? '#ffffff' : 'var(--text-med)',
                    background: activeTab === item.tab ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    border:
                      activeTab === item.tab
                        ? '1px solid rgba(99, 102, 241, 0.3)'
                        : '1px solid transparent',
                    boxShadow: 'none',
                    fontWeight: 500,
                    borderRadius: '8px',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Icon name={item.icon as any} style={{ margin: 0 }} />
                  {item.label}
                </Button>
              ))}
            </div>

            <Button
              type="button"
              basic
              color="red"
              onClick={onLock}
              style={{
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginLeft: '8px',
              }}
            >
              <Icon name="lock" style={{ margin: 0 }} /> Lock
            </Button>
          </Menu.Menu>
        </Menu>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>{children}</div>
      </div>
    </div>
  );
};
