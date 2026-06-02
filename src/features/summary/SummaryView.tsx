import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Container,
  Header,
  Button,
  Segment,
  Grid,
  Statistic,
  List,
  Icon,
  Message,
} from 'semantic-ui-react';
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
        <Segment
          basic
          textAlign="center"
          style={{
            padding: '40px',
            color: 'var(--text-med)',
          }}
        >
          <Icon name="spinner" loading /> Loading summary details...
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

    if (!summary) return null;

    return (
      <>
        {/* Stats Bar */}
        <Segment
          className="glass-panel"
          style={{
            padding: '20px',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            margin: '0 0 16px 0',
          }}
        >
          <Statistic.Group widths={4} size="small" inverted style={{ margin: 0 }}>
            <Statistic color="green">
              <Statistic.Value>{stats.completed}</Statistic.Value>
              <Statistic.Label
                style={{
                  color: 'var(--text-low)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginTop: '4px',
                }}
              >
                Completed
              </Statistic.Label>
            </Statistic>
            <Statistic color="blue">
              <Statistic.Value>{stats.active}</Statistic.Value>
              <Statistic.Label
                style={{
                  color: 'var(--text-low)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginTop: '4px',
                }}
              >
                In Progress
              </Statistic.Label>
            </Statistic>
            <Statistic color="orange">
              <Statistic.Value>{stats.pending}</Statistic.Value>
              <Statistic.Label
                style={{
                  color: 'var(--text-low)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginTop: '4px',
                }}
              >
                On My Plate
              </Statistic.Label>
            </Statistic>
            <Statistic color="purple">
              <Statistic.Value>{completionRate}%</Statistic.Value>
              <Statistic.Label
                style={{
                  color: 'var(--text-low)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginTop: '4px',
                }}
              >
                Completion Rate
              </Statistic.Label>
            </Statistic>
          </Statistic.Group>
        </Segment>

        {/* Date range subtitle */}
        <div
          style={{
            fontSize: '14px',
            color: 'var(--text-med)',
            marginTop: '8px',
            marginBottom: '16px',
          }}
        >
          Showing activity from <strong>{summary.start_date}</strong> to{' '}
          <strong>{summary.end_date}</strong>.
        </div>

        {/* Projects and tasks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {summary.projects.length === 0 ? (
            <Segment
              className="glass-panel"
              style={{
                padding: '32px',
                textAlign: 'center',
                color: 'var(--text-med)',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
              }}
            >
              No active tasks found in this period. Start working on your plate!
            </Segment>
          ) : (
            summary.projects.map((p) => (
              <Segment
                key={p.project_name}
                className="summary-project-card"
                style={{
                  background: 'rgba(15, 23, 42, 0.3)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: '12px',
                  padding: '20px',
                  margin: 0,
                }}
              >
                <Header
                  as="h3"
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'var(--text-high)',
                    margin: '0 0 16px 0',
                  }}
                >
                  {p.project_name === 'Ad-hoc' ? '📦 Ad-hoc Tasks' : `📂 ${p.project_name}`}
                </Header>

                <Grid columns={3} stackable divided style={{ margin: 0 }}>
                  {/* Completed */}
                  <Grid.Column style={{ padding: '0 10px' }}>
                    <Header
                      as="h5"
                      color="green"
                      style={{
                        textTransform: 'uppercase',
                        fontSize: '12px',
                        fontWeight: 600,
                        margin: '0 0 12px 0',
                      }}
                    >
                      Done ({p.completed.length})
                    </Header>
                    <List relaxed style={{ margin: 0 }}>
                      {p.completed.length === 0 ? (
                        <span
                          style={{
                            color: 'var(--text-low)',
                            fontSize: '13px',
                            fontStyle: 'italic',
                          }}
                        >
                          None completed
                        </span>
                      ) : (
                        p.completed.map((t) => (
                          <List.Item
                            key={t}
                            style={{
                              color: 'var(--text-med)',
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 0',
                            }}
                          >
                            <Icon name="check circle" color="green" style={{ margin: 0 }} />
                            <span>{t}</span>
                          </List.Item>
                        ))
                      )}
                    </List>
                  </Grid.Column>

                  {/* In Progress */}
                  <Grid.Column style={{ padding: '0 10px' }}>
                    <Header
                      as="h5"
                      color="blue"
                      style={{
                        textTransform: 'uppercase',
                        fontSize: '12px',
                        fontWeight: 600,
                        margin: '0 0 12px 0',
                      }}
                    >
                      In Progress ({p.in_progress.length})
                    </Header>
                    <List relaxed style={{ margin: 0 }}>
                      {p.in_progress.length === 0 ? (
                        <span
                          style={{
                            color: 'var(--text-low)',
                            fontSize: '13px',
                            fontStyle: 'italic',
                          }}
                        >
                          None in progress
                        </span>
                      ) : (
                        p.in_progress.map((t) => (
                          <List.Item
                            key={t}
                            style={{
                              color: 'var(--text-med)',
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 0',
                            }}
                          >
                            <Icon name="play circle" color="blue" style={{ margin: 0 }} />
                            <span>{t}</span>
                          </List.Item>
                        ))
                      )}
                    </List>
                  </Grid.Column>

                  {/* Pending */}
                  <Grid.Column style={{ padding: '0 10px' }}>
                    <Header
                      as="h5"
                      color="orange"
                      style={{
                        textTransform: 'uppercase',
                        fontSize: '12px',
                        fontWeight: 600,
                        margin: '0 0 12px 0',
                      }}
                    >
                      On My Plate ({p.pending.length})
                    </Header>
                    <List relaxed style={{ margin: 0 }}>
                      {p.pending.length === 0 ? (
                        <span
                          style={{
                            color: 'var(--text-low)',
                            fontSize: '13px',
                            fontStyle: 'italic',
                          }}
                        >
                          No tasks on plate
                        </span>
                      ) : (
                        p.pending.map((t) => (
                          <List.Item
                            key={t}
                            style={{
                              color: 'var(--text-med)',
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 0',
                            }}
                          >
                            <Icon name="hourglass outline" color="orange" style={{ margin: 0 }} />
                            <span>{t}</span>
                          </List.Item>
                        ))
                      )}
                    </List>
                  </Grid.Column>
                </Grid>
              </Segment>
            ))
          )}
        </div>
      </>
    );
  };

  return (
    <Container
      className="summary-container"
      style={{
        padding: '24px',
        margin: '0 auto',
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
            📈 Productivity Summaries
          </Header>
          <p style={{ color: 'var(--text-med)', fontSize: '14px', marginTop: '4px', margin: 0 }}>
            Track what you&apos;ve achieved, what you&apos;ve worked on, and what&apos;s remaining.
          </p>
        </div>

        <div
          className="summary-controls"
          style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
        >
          <Button.Group size="small">
            <Button
              active={summaryType === 'daily'}
              onClick={() => {
                setSummaryType('daily');
                setSelectedDate(new Date().toISOString().split('T')[0]);
              }}
              style={{
                background: summaryType === 'daily' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: summaryType === 'daily' ? '#ffffff' : 'var(--text-med)',
                border:
                  summaryType === 'daily'
                    ? '1px solid rgba(99, 102, 241, 0.3)'
                    : '1px solid rgba(255,255,255,0.05)',
                fontWeight: 500,
              }}
            >
              Daily
            </Button>
            <Button
              active={summaryType === 'weekly'}
              onClick={() => {
                setSummaryType('weekly');
                // Default weekly focus starts 6 days ago (covers 7 days total)
                const start = new Date();
                start.setDate(start.getDate() - 6);
                setSelectedDate(start.toISOString().split('T')[0]);
              }}
              style={{
                background: summaryType === 'weekly' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: summaryType === 'weekly' ? '#ffffff' : 'var(--text-med)',
                border:
                  summaryType === 'weekly'
                    ? '1px solid rgba(99, 102, 241, 0.3)'
                    : '1px solid rgba(255,255,255,0.05)',
                fontWeight: 500,
              }}
            >
              Weekly
            </Button>
          </Button.Group>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              e.target.blur();
            }}
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-high)',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none',
              height: '34px',
            }}
          />
        </div>
      </div>

      {renderContent()}
    </Container>
  );
};
