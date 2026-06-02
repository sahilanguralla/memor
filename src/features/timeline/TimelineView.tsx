import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Container, Header, Input, Feed, Label, Segment, Icon, Message } from 'semantic-ui-react';
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
        <Segment
          basic
          textAlign="center"
          style={{
            padding: '40px',
            color: 'var(--text-med)',
          }}
        >
          <Icon name="spinner" loading /> Loading activity logs...
        </Segment>
      );
    }

    if (error) {
      return (
        <Message negative style={{ textAlign: 'center', margin: '20px' }}>
          {error}
        </Message>
      );
    }

    if (filteredUpdates.length === 0) {
      return (
        <Segment
          className="glass-panel"
          style={{
            padding: '40px',
            textAlign: 'center',
            color: 'var(--text-med)',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
          }}
        >
          {searchQuery
            ? 'No matching activity found.'
            : 'No task updates logged yet. Progress updates will appear here.'}
        </Segment>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
        {sortedDates.map((date) => (
          <div key={date} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Date Header */}
            <Header
              as="h4"
              dividing
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                margin: '24px 0 12px 0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '6px',
              }}
            >
              {formatDateLabel(date)}
            </Header>

            {/* Timeline Items Feed */}
            <Feed size="large" style={{ paddingLeft: '8px', margin: 0 }}>
              {groupedUpdates[date].map((update) => {
                let semanticColor: any = 'grey';
                let iconName: any = 'hourglass outline';
                if (update.status === 'done') {
                  semanticColor = 'green';
                  iconName = 'check circle';
                } else if (update.status === 'in_progress') {
                  semanticColor = 'blue';
                  iconName = 'play circle';
                } else if (update.status === 'todo') {
                  semanticColor = 'orange';
                  iconName = 'hourglass outline';
                }

                return (
                  <Feed.Event key={update.id} style={{ padding: '8px 0' }}>
                    <Feed.Label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingTop: '4px',
                      }}
                    >
                      <Icon name={iconName} color={semanticColor} size="large" />
                    </Feed.Label>
                    <Feed.Content>
                      <Segment
                        className="glass-panel"
                        style={{
                          background: 'var(--glass-bg)',
                          border: '1px solid var(--glass-border)',
                          padding: '12px 16px',
                          margin: 0,
                          borderRadius: '8px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '12px',
                            marginBottom: '6px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: 'var(--text-high)',
                            }}
                          >
                            {update.task_title}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-low)' }}>
                            {formatTime(update.created_at)}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: '13px',
                            color: 'var(--text-med)',
                            wordBreak: 'break-word',
                            marginBottom: '8px',
                          }}
                        >
                          {update.update_text}
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Label size="mini" color="blue" style={{ margin: 0 }}>
                            📈 Progress: {update.completion_percentage}%
                          </Label>
                          <Label size="mini" color={semanticColor} style={{ margin: 0 }}>
                            {statusLabels[update.status] || update.status}
                          </Label>
                        </div>
                      </Segment>
                    </Feed.Content>
                  </Feed.Event>
                );
              })}
            </Feed>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Container
      className="summary-container"
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%',
        padding: '24px',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      <div
        className="summary-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <div>
          <Header as="h2" className="view-title" style={{ margin: 0, color: 'var(--text-high)' }}>
            📜 Task Activity Timeline
          </Header>
          <p style={{ color: 'var(--text-med)', fontSize: '14px', marginTop: '4px', margin: 0 }}>
            A chronological feed of all task progress updates, status changes, and logged notes.
          </p>
        </div>

        <div className="summary-controls">
          <Input
            icon="search"
            iconPosition="left"
            placeholder="Search activity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            style={{ width: '220px' }}
          />
        </div>
      </div>

      {renderContent()}
    </Container>
  );
};
