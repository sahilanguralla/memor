import { Menu, Button, Label } from 'semantic-ui-react';
import { Project } from '../../../domain/types';
import { DashboardView } from '../types';
import { getPriorityLabel } from '../utils';

interface DashboardSidebarProps {
  activeView: DashboardView;
  onOpenArchived: () => void;
  onOpenCreateProject: () => void;
  onOpenTrash: () => void;
  onSelectProject: (projectId: number | null) => void;
  onSelectView: (view: DashboardView) => void;
  projects: Project[];
  selectedProjectId: number | null;
}

export const DashboardSidebar = ({
  activeView,
  onOpenArchived,
  onOpenCreateProject,
  onOpenTrash,
  onSelectProject,
  onSelectView,
  projects,
  selectedProjectId,
}: DashboardSidebarProps) => {
  return (
    <Menu
      vertical
      className="app-sidebar"
      style={{
        height: '100%',
        flex: '0 0 var(--sidebar-width)',
        borderRadius: 0,
        margin: 0,
        border: 'none',
        borderRight: '1px solid var(--panel-border)',
        background: 'var(--panel-bg)',
      }}
    >
      <Menu.Item style={{ padding: '24px 20px 12px 20px', background: 'transparent' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-low)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Smart Views
        </span>
      </Menu.Item>

      <Menu.Menu
        style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}
      >
        <Menu.Item
          active={activeView === 'my_day'}
          onClick={() => onSelectView('my_day')}
          style={{
            borderRadius: '8px',
            color: activeView === 'my_day' ? 'var(--primary)' : 'var(--text-med)',
            background: activeView === 'my_day' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            padding: '10px 12px',
            cursor: 'pointer',
          }}
        >
          <span>☀️ My Day</span>
        </Menu.Item>
        <Menu.Item
          active={activeView === 'weekly_focus'}
          onClick={() => onSelectView('weekly_focus')}
          style={{
            borderRadius: '8px',
            color: activeView === 'weekly_focus' ? 'var(--primary)' : 'var(--text-med)',
            background: activeView === 'weekly_focus' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            padding: '10px 12px',
            cursor: 'pointer',
          }}
        >
          <span>📅 Weekly Focus</span>
        </Menu.Item>
      </Menu.Menu>

      <Menu.Item
        className="sidebar-header"
        style={{
          padding: '24px 20px 12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'transparent',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-low)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Projects
        </span>
        <Button
          circular
          icon="plus"
          size="mini"
          basic
          inverted
          onClick={onOpenCreateProject}
          style={{ padding: '4px', margin: 0, color: 'var(--text-low)' }}
        />
      </Menu.Item>

      <Menu.Menu
        className="project-list"
        style={{
          padding: '0 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {projects.map((project) => {
          const priority = getPriorityLabel(project.project_priority);
          const isProjectActive =
            activeView === 'project' && selectedProjectId === project.project_id;

          let semanticColor: any = 'grey';
          if (project.project_priority === 2) semanticColor = 'red';
          else if (project.project_priority === 1) semanticColor = 'orange';
          else if (project.project_priority === 0) semanticColor = 'green';

          return (
            <Menu.Item
              key={project.project_id ?? 'adhoc'}
              active={isProjectActive}
              onClick={() => onSelectProject(project.project_id)}
              style={{
                borderRadius: '8px',
                color: isProjectActive ? 'var(--primary)' : 'var(--text-med)',
                background: isProjectActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '14px',
                padding: '10px 12px',
                cursor: 'pointer',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.project_id === null ? '📦 ' : '📂 '}
                {project.project_name}
              </span>
              {project.project_id !== null && (
                <Label size="mini" color={semanticColor} style={{ marginLeft: '6px' }}>
                  {priority.text}
                </Label>
              )}
            </Menu.Item>
          );
        })}
      </Menu.Menu>

      <Menu.Item
        style={{
          padding: '24px 20px 12px 20px',
          borderTop: '1px solid var(--panel-border)',
          marginTop: 'auto',
          background: 'transparent',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-low)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Management
        </span>
      </Menu.Item>

      <Menu.Menu
        style={{
          padding: '0 12px 16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <Menu.Item
          onClick={onOpenArchived}
          style={{
            borderRadius: '8px',
            color: 'var(--text-med)',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            padding: '10px 12px',
            cursor: 'pointer',
          }}
        >
          <span>📁 Archived Projects</span>
        </Menu.Item>
        <Menu.Item
          onClick={onOpenTrash}
          style={{
            borderRadius: '8px',
            color: 'var(--text-med)',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            padding: '10px 12px',
            cursor: 'pointer',
          }}
        >
          <span>🗑️ Trash Bin</span>
        </Menu.Item>
      </Menu.Menu>
    </Menu>
  );
};
