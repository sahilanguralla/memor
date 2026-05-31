import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SummaryResponse } from '../../domain/types';

export const SummaryView: React.FC = () => {
  const [summaryType, setSummaryType] = useState<'daily' | 'weekly'>('daily');
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      setError('');
      try {
        if (summaryType === 'daily') {
          const res = await invoke<SummaryResponse>('get_daily_summary', { date: selectedDate });
          setSummary(res);
        } else {
          const res = await invoke<SummaryResponse>('get_weekly_summary', {
            startDate: selectedDate,
          });
          setSummary(res);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [summaryType, selectedDate]);

  // Calculate statistics
  const getStats = () => {
    if (!summary) return { completed: 0, active: 0, pending: 0 };
    let completed = 0;
    let active = 0;
    let pending = 0;

    summary.projects.forEach((p) => {
      completed += p.completed.length;
      active += p.in_progress.length;
      pending += p.pending.length;
    });

    return { completed, active, pending };
  };

  const stats = getStats();
  const totalTasks = stats.completed + stats.active + stats.pending;
  const completionRate = totalTasks > 0 ? Math.round((stats.completed / totalTasks) * 100) : 0;

  const renderContent = () => {
    if (loading) {
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '40px',
            color: 'var(--text-med)',
          }}
        >
          Loading summary details...
        </div>
      );
    }

    if (error) {
      return (
        <div className="lock-error" style={{ textAlign: 'center', padding: '20px' }}>
          {error}
        </div>
      );
    }

    if (!summary) return null;

    return (
      <>
        {/* Stats Bar */}
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
            textAlign: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-low)',
                textTransform: 'uppercase',
                fontWeight: '600',
              }}
            >
              Completed
            </div>
            <div
              style={{
                fontSize: '28px',
                fontWeight: '700',
                color: 'var(--accent)',
                marginTop: '4px',
              }}
            >
              {stats.completed}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-low)',
                textTransform: 'uppercase',
                fontWeight: '600',
              }}
            >
              In Progress
            </div>
            <div
              style={{
                fontSize: '28px',
                fontWeight: '700',
                color: 'var(--primary)',
                marginTop: '4px',
              }}
            >
              {stats.active}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-low)',
                textTransform: 'uppercase',
                fontWeight: '600',
              }}
            >
              On My Plate
            </div>
            <div
              style={{
                fontSize: '28px',
                fontWeight: '700',
                color: 'var(--warn)',
                marginTop: '4px',
              }}
            >
              {stats.pending}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-low)',
                textTransform: 'uppercase',
                fontWeight: '600',
              }}
            >
              Completion Rate
            </div>
            <div
              style={{ fontSize: '28px', fontWeight: '700', color: '#a5b4fc', marginTop: '4px' }}
            >
              {completionRate}%
            </div>
          </div>
        </div>

        {/* Date range subtitle */}
        <div style={{ fontSize: '14px', color: 'var(--text-med)', marginTop: '8px' }}>
          Showing activity from <strong>{summary.start_date}</strong> to{' '}
          <strong>{summary.end_date}</strong>.
        </div>

        {/* Projects and tasks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {summary.projects.length === 0 ? (
            <div
              className="glass-panel"
              style={{ padding: '32px', textAlign: 'center', color: 'var(--text-med)' }}
            >
              No active tasks found in this period. Start working on your plate!
            </div>
          ) : (
            summary.projects.map((p) => (
              <div key={p.project_name} className="summary-project-card">
                <h3 className="summary-project-name">
                  {p.project_name === 'Ad-hoc' ? '📦 Ad-hoc Tasks' : `📂 ${p.project_name}`}
                </h3>

                <div className="summary-grids">
                  {/* Completed */}
                  <div className="summary-list-box">
                    <div className="summary-list-title completed">Done ({p.completed.length})</div>
                    {p.completed.length === 0 ? (
                      <div
                        style={{
                          color: 'var(--text-low)',
                          fontSize: '13px',
                          fontStyle: 'italic',
                        }}
                      >
                        None completed
                      </div>
                    ) : (
                      p.completed.map((t) => (
                        <div key={t} className="summary-task-item completed">
                          {t}
                        </div>
                      ))
                    )}
                  </div>

                  {/* In Progress */}
                  <div className="summary-list-box">
                    <div className="summary-list-title in-progress">
                      In Progress ({p.in_progress.length})
                    </div>
                    {p.in_progress.length === 0 ? (
                      <div
                        style={{
                          color: 'var(--text-low)',
                          fontSize: '13px',
                          fontStyle: 'italic',
                        }}
                      >
                        None in progress
                      </div>
                    ) : (
                      p.in_progress.map((t) => (
                        <div key={t} className="summary-task-item in-progress">
                          {t}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Pending */}
                  <div className="summary-list-box">
                    <div className="summary-list-title pending">
                      On My Plate ({p.pending.length})
                    </div>
                    {p.pending.length === 0 ? (
                      <div
                        style={{
                          color: 'var(--text-low)',
                          fontSize: '13px',
                          fontStyle: 'italic',
                        }}
                      >
                        No tasks on plate
                      </div>
                    ) : (
                      p.pending.map((t) => (
                        <div key={t} className="summary-task-item pending">
                          {t}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </>
    );
  };

  return (
    <div className="summary-container">
      <div className="summary-header">
        <div>
          <h2 className="view-title">📈 Productivity Summaries</h2>
          <p style={{ color: 'var(--text-med)', fontSize: '14px', marginTop: '4px' }}>
            Track what you&apos;ve achieved, what you&apos;ve worked on, and what&apos;s remaining.
          </p>
        </div>

        <div className="summary-controls">
          <div
            style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              padding: '2px',
              border: '1px solid var(--glass-border)',
            }}
          >
            <button
              type="button"
              className={`nav-btn ${summaryType === 'daily' ? 'active' : ''}`}
              onClick={() => {
                setSummaryType('daily');
                setSelectedDate(new Date().toISOString().split('T')[0]);
              }}
              style={{ padding: '6px 12px' }}
            >
              Daily
            </button>
            <button
              type="button"
              className={`nav-btn ${summaryType === 'weekly' ? 'active' : ''}`}
              onClick={() => {
                setSummaryType('weekly');
                // Default weekly focus starts 6 days ago (covers 7 days total)
                const start = new Date();
                start.setDate(start.getDate() - 6);
                setSelectedDate(start.toISOString().split('T')[0]);
              }}
              style={{ padding: '6px 12px' }}
            >
              Weekly
            </button>
          </div>

          <input
            type="date"
            className="form-input"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              e.target.blur();
            }}
            style={{ padding: '8px 12px' }}
          />
        </div>
      </div>

      {renderContent()}
    </div>
  );
};
