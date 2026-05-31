import { Project } from '../../../domain/types';
import { DashboardView } from '../types';

interface DashboardHeaderProps {
  activeView: DashboardView;
  onAddTask: () => void;
  onArchiveProject: (projectId: number) => void;
  onDateChange: (date: string) => void;
  onDeleteProject: (projectId: number) => void;
  onOpenPlanTomorrow: () => void;
  onShiftDate: (days: number) => void;
  projects: Project[];
  selectedDate: string;
  selectedProjectId: number | null;
}

const viewTitles: Record<DashboardView, string> = {
  my_day: '☀️ My Day Priorities',
  weekly_focus: '📅 Weekly Focus Priorities',
  project: 'Project',
};

const viewSubtitles: Record<DashboardView, string> = {
  my_day: "Tasks you've flagged to focus on today",
  weekly_focus: 'Major initiatives for the current week',
  project: 'Manage tasks in this project',
};

export const DashboardHeader = ({
  activeView,
  onAddTask,
  onArchiveProject,
  onDateChange,
  onDeleteProject,
  onOpenPlanTomorrow,
  onShiftDate,
  projects,
  selectedDate,
  selectedProjectId,
}: DashboardHeaderProps) => {
  const selectedProject = projects.find((project) => project.project_id === selectedProjectId);

  return (
    <div className="view-header">
      <div>
        <h2 className="view-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {activeView !== 'project' && viewTitles[activeView]}
          {activeView === 'project' && (
            <>
              📂 {selectedProject?.project_name || viewTitles.project}
              {selectedProjectId !== null && (
                <div style={{ display: 'inline-flex', gap: '8px', marginLeft: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => onArchiveProject(selectedProjectId)}
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                    title="Archive Project"
                  >
                    📥 Archive
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => onDeleteProject(selectedProjectId)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      borderColor: 'rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                    }}
                    title="Delete Project"
                  >
                    🗑️ Delete
                  </button>
                </div>
              )}
            </>
          )}
        </h2>
        <p style={{ color: 'var(--text-med)', fontSize: '14px', marginTop: '4px' }}>
          {viewSubtitles[activeView]}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            border: '1px solid var(--glass-border)',
            padding: '2px',
          }}
        >
          <button
            type="button"
            className="action-btn"
            onClick={() => onShiftDate(-1)}
            title="Previous Day"
            style={{ padding: '6px 10px', fontSize: '14px', color: 'var(--text-high)' }}
          >
            ◀
          </button>
          <input
            type="date"
            className="form-input"
            value={selectedDate}
            onChange={(event) => {
              onDateChange(event.target.value);
              event.target.blur();
            }}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '4px 8px',
              fontSize: '14px',
              color: 'var(--text-high)',
              outline: 'none',
            }}
          />
          <button
            type="button"
            className="action-btn"
            onClick={() => onShiftDate(1)}
            title="Next Day"
            style={{ padding: '6px 10px', fontSize: '14px', color: 'var(--text-high)' }}
          >
            ▶
          </button>
        </div>
        {activeView === 'my_day' && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onOpenPlanTomorrow}
            style={{
              background: 'rgba(99, 102, 241, 0.1)',
              color: '#a5b4fc',
              borderColor: 'rgba(99, 102, 241, 0.2)',
            }}
          >
            🔮 Plan Tomorrow
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={onAddTask}>
          + Add Task
        </button>
      </div>
    </div>
  );
};
