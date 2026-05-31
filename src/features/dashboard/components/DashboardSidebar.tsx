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
    <div className="sidebar">
      <div className="sidebar-header">
        <span>Smart Views</span>
      </div>
      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <button
          type="button"
          className={`project-item ${activeView === 'my_day' ? 'active' : ''}`}
          onClick={() => onSelectView('my_day')}
        >
          <span>☀️ My Day</span>
        </button>
        <button
          type="button"
          className={`project-item ${activeView === 'weekly_focus' ? 'active' : ''}`}
          onClick={() => onSelectView('weekly_focus')}
        >
          <span>📅 Weekly Focus</span>
        </button>
      </div>

      <div className="sidebar-header" style={{ marginTop: '16px' }}>
        <span>Projects</span>
        <button
          type="button"
          onClick={onOpenCreateProject}
          className="action-btn"
          style={{ fontSize: '16px' }}
        >
          +
        </button>
      </div>
      <div className="project-list">
        {projects.map((project) => {
          const priority = getPriorityLabel(project.project_priority);

          return (
            <button
              type="button"
              key={project.project_id ?? 'adhoc'}
              className={`project-item ${
                activeView === 'project' && selectedProjectId === project.project_id ? 'active' : ''
              }`}
              onClick={() => onSelectProject(project.project_id)}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.project_id === null ? '📦 ' : '📂 '}
                {project.project_name}
              </span>
              {project.project_id !== null && (
                <span className={`project-badge ${priority.className}`}>{priority.text}</span>
              )}
            </button>
          );
        })}
      </div>

      <div
        className="sidebar-header"
        style={{
          marginTop: 'auto',
          borderTop: '1px solid var(--panel-border)',
          paddingTop: '12px',
        }}
      >
        <span>Management</span>
      </div>
      <div
        style={{
          padding: '0 12px 16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <button
          type="button"
          className="project-item"
          onClick={onOpenArchived}
          style={{ color: 'var(--text-med)' }}
        >
          <span>📁 Archived Projects</span>
        </button>
        <button
          type="button"
          className="project-item"
          onClick={onOpenTrash}
          style={{ color: 'var(--text-med)' }}
        >
          <span>🗑️ Trash Bin</span>
        </button>
      </div>
    </div>
  );
};
