import { Header, Button, Icon } from 'semantic-ui-react';
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
    <div
      className="view-header"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
      }}
    >
      <div>
        <Header
          as="h2"
          className="view-title"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            margin: 0,
            color: 'var(--text-high)',
          }}
        >
          {activeView !== 'project' && viewTitles[activeView]}
          {activeView === 'project' && (
            <>
              📂 {selectedProject?.project_name || viewTitles.project}
              {selectedProjectId !== null && (
                <div style={{ display: 'inline-flex', gap: '8px', marginLeft: '12px' }}>
                  <Button
                    basic
                    compact
                    size="tiny"
                    color="blue"
                    onClick={() => onArchiveProject(selectedProjectId)}
                    title="Archive Project"
                  >
                    <Icon name="archive" /> Archive
                  </Button>
                  <Button
                    basic
                    compact
                    size="tiny"
                    color="red"
                    onClick={() => onDeleteProject(selectedProjectId)}
                    title="Delete Project"
                  >
                    <Icon name="trash" /> Delete
                  </Button>
                </div>
              )}
            </>
          )}
        </Header>
        <p style={{ color: 'var(--text-med)', fontSize: '14px', marginTop: '4px', margin: 0 }}>
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
          <Button
            icon="angle left"
            basic
            inverted
            compact
            onClick={() => onShiftDate(-1)}
            title="Previous Day"
            style={{
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
            }}
          />
          <input
            type="date"
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
              width: '140px',
            }}
          />
          <Button
            icon="angle right"
            basic
            inverted
            compact
            onClick={() => onShiftDate(1)}
            title="Next Day"
            style={{
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
            }}
          />
        </div>
        {activeView === 'my_day' && (
          <Button
            color="violet"
            onClick={onOpenPlanTomorrow}
            size="small"
            style={{
              background: 'rgba(99, 102, 241, 0.1)',
              color: '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: '8px',
              padding: '10px 16px',
            }}
          >
            <Icon name="magic" /> Plan Tomorrow
          </Button>
        )}
        <Button
          primary
          icon="plus"
          labelPosition="left"
          onClick={onAddTask}
          size="small"
          content="Add Task"
          style={{ borderRadius: '8px', padding: '10px 16px' }}
        />
      </div>
    </div>
  );
};
