import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { TaskUpdate } from '../../domain/types';

export const TimelineView: React.FC = () => {
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTimeline = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await invoke<TaskUpdate[]>('get_timeline');
      setUpdates(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();

    // Listen to changes in background and reload timeline automatically
    let unlisten: (() => void) | null = null;
    const setupListener = async () => {
      unlisten = await listen('tasks-changed', () => {
        fetchTimeline();
      });
    };
    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Filter updates based on search query
  const filteredUpdates = updates.filter(
    (up) =>
      up.task_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      up.update_text.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Group updates by date
  const groupedUpdates: { [date: string]: TaskUpdate[] } = {};
  filteredUpdates.forEach((up) => {
    if (!groupedUpdates[up.date]) {
      groupedUpdates[up.date] = [];
    }
    groupedUpdates[up.date].push(up);
  });

  // Sort dates descending
  const sortedDates = Object.keys(groupedUpdates).sort((a, b) => b.localeCompare(a));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'var(--accent)';
      case 'in_progress':
        return 'var(--primary)';
      default:
        return 'var(--warn)';
    }
  };

  const getStatusGlow = (status: string) => {
    switch (status) {
      case 'done':
        return 'var(--accent-glow)';
      case 'in_progress':
        return 'var(--primary-glow)';
      default:
        return 'var(--warn-glow)';
    }
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return date.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
    } catch (_) {
      // Fallback to displaying original dateStr if parsing fails
    }
    return dateStr;
  };

  const formatTime = (isoString: string) => {
    try {
      // Support SQLite UTC datetime string (YYYY-MM-DD HH:MM:SS) or ISO
      // If it contains space, replace it to help parsed
      const standardStr = isoString.replace(' ', 'T');
      const date = new Date(standardStr);
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  };

  const statusLabels: { [key: string]: string } = {
    todo: 'todo',
    in_progress: 'in progress',
    done: 'done',
  };

  const renderContent = () => {
    if (loading && updates.length === 0) {
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '40px',
            color: 'var(--text-med)',
          }}
        >
          Loading activity logs...
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

    if (filteredUpdates.length === 0) {
      return (
        <div
          className="glass-panel"
          style={{ padding: '40px', textAlign: 'center', color: 'var(--text-med)' }}
        >
          {searchQuery
            ? 'No matching activity found.'
            : 'No task updates logged yet. Progress updates will appear here.'}
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '8px' }}>
        {sortedDates.map((date) => (
          <div key={date} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Date Header */}
            <div
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                paddingBottom: '6px',
              }}
            >
              {formatDateLabel(date)}
            </div>

            {/* Timeline Items */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                paddingLeft: '8px',
                position: 'relative',
              }}
            >
              {/* Vertical timeline line */}
              <div
                style={{
                  position: 'absolute',
                  left: '17px',
                  top: '10px',
                  bottom: '10px',
                  width: '2px',
                  background: 'rgba(255,255,255,0.06)',
                }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {groupedUpdates[date].map((update) => (
                  <div
                    key={update.id}
                    style={{
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'flex-start',
                      position: 'relative',
                    }}
                  >
                    {/* Circle node indicator */}
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: getStatusGlow(update.status),
                        border: `2px solid ${getStatusColor(update.status)}`,
                        zIndex: 2,
                        marginTop: '12px',
                        flexShrink: 0,
                        boxShadow: `0 0 10px ${getStatusGlow(update.status)}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    />

                    {/* Content Card */}
                    <div
                      className="glass-panel"
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'transform 0.2s ease, border-color 0.2s ease',
                        cursor: 'default',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '12px',
                        }}
                      >
                        <h4
                          style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: 'var(--text-high)',
                          }}
                        >
                          {update.task_title}
                        </h4>
                        <span style={{ fontSize: '11px', color: 'var(--text-low)' }}>
                          {formatTime(update.created_at)}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-med)',
                          wordBreak: 'break-word',
                        }}
                      >
                        {update.update_text}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            background: 'var(--primary-glow)',
                            borderRadius: '4px',
                            color: '#a5b4fc',
                            fontWeight: '500',
                          }}
                        >
                          📈 Progress: {update.completion_percentage}%
                        </span>

                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            background:
                              update.status === 'done'
                                ? 'var(--accent-glow)'
                                : 'rgba(255,255,255,0.04)',
                            borderRadius: '4px',
                            color: update.status === 'done' ? 'var(--accent)' : 'var(--text-med)',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                          }}
                        >
                          {statusLabels[update.status] || update.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className="summary-container"
      style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}
    >
      <div className="summary-header">
        <div>
          <h2 className="view-title">📜 Task Activity Timeline</h2>
          <p style={{ color: 'var(--text-med)', fontSize: '14px', marginTop: '4px' }}>
            A chronological feed of all task progress updates, status changes, and logged notes.
          </p>
        </div>

        <div className="summary-controls">
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search activity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '220px', padding: '8px 12px' }}
          />
        </div>
      </div>

      {renderContent()}
    </div>
  );
};
