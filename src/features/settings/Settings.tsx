import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Container,
  Header,
  Segment,
  Form,
  Button,
  Checkbox,
  Message,
  Icon,
} from 'semantic-ui-react';
import { AppConfig } from '../../domain/types';
import { showAlert } from '../../shared/utils/dialogs';

interface SettingsProps {
  onLock: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onLock }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await invoke<AppConfig>('get_config');
        setConfig(res);
      } catch (err) {
        console.error('Failed to load config:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const saveConfig = async (newConfig: AppConfig) => {
    setSaving(true);
    setMessage('');
    try {
      await invoke('update_config', { config: newConfig });
      setMessage('Settings saved successfully.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      showAlert(`Failed to save settings: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateKeyring = async (enabled: boolean) => {
    if (!config) return;
    const newConfig = { ...config, keyring_enabled: enabled };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleUpdateTimeout = async (mins: number) => {
    if (!config) return;
    const newConfig = { ...config, auto_lock_timeout_mins: mins };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleUpdateTrashRetention = async (days: number) => {
    if (!config) return;
    const newConfig = { ...config, trash_retention_days: days };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleManualLock = async () => {
    try {
      await invoke('lock_db');
      onLock();
    } catch (err) {
      console.error('Failed to lock db:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ color: 'var(--text-med)', padding: '40px', textAlign: 'center' }}>
        <Icon name="spinner" loading /> Loading settings...
      </div>
    );
  }

  return (
    <Container
      className="settings-view"
      style={{
        maxWidth: '640px',
        padding: '40px 0',
        margin: '0 auto',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      <Header
        as="h2"
        className="view-title"
        style={{ marginBottom: '24px', color: 'var(--text-high)' }}
      >
        ⚙️ Application Settings
      </Header>

      {/* Security Section */}
      <Segment
        raised
        className="settings-section"
        style={{
          background: 'rgba(15, 23, 42, 0.3)',
          border: '1px solid var(--panel-border)',
          borderRadius: '12px',
          padding: '24px',
          margin: '0 0 24px 0',
        }}
      >
        <Header
          as="h3"
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-high)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            paddingBottom: '8px',
            margin: '0 0 16px 0',
          }}
        >
          Security & Biometrics
        </Header>

        <Form style={{ background: 'transparent' }}>
          <Form.Field>
            <Checkbox
              id="keyring-toggle-checkbox"
              toggle
              checked={config?.keyring_enabled || false}
              onChange={(_, data) => handleUpdateKeyring(Boolean(data.checked))}
              disabled={saving}
              label="Secure Auto-Unlock"
            />
            <p style={{ fontSize: '12px', color: 'var(--text-low)', marginTop: '8px', margin: 0 }}>
              Store the database decryption key in your system&apos;s secure keyring. Uses native
              biometrics or system login password to decrypt automatically on startup.
            </p>
          </Form.Field>
        </Form>
      </Segment>

      {/* Auto-Lock Section */}
      <Segment
        raised
        className="settings-section"
        style={{
          background: 'rgba(15, 23, 42, 0.3)',
          border: '1px solid var(--panel-border)',
          borderRadius: '12px',
          padding: '24px',
          margin: '0 0 24px 0',
        }}
      >
        <Header
          as="h3"
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-high)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            paddingBottom: '8px',
            margin: '0 0 16px 0',
          }}
        >
          Session Lock Timeout
        </Header>

        <Form style={{ background: 'transparent' }}>
          <Form.Field
            label={{
              content: 'Idle Auto-Lock Timeout',
              style: {
                color: 'var(--text-med)',
                fontSize: '13px',
                fontWeight: 500,
              },
            }}
            control="select"
            className="ui dropdown"
            value={config?.auto_lock_timeout_mins ?? 15}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              handleUpdateTimeout(Number(e.target.value))
            }
            disabled={saving}
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-high)',
              padding: '10px 12px',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none',
              width: '100%',
            }}
          >
            <option value={0}>Never Auto-Lock</option>
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
          </Form.Field>
          <p style={{ fontSize: '12px', color: 'var(--text-low)', marginTop: '8px', margin: 0 }}>
            The application will automatically lock and clear decrypted keys from memory if no
            keyboard or mouse activity is detected for the selected period.
          </p>
        </Form>
      </Segment>

      {/* Trash Retention Section */}
      <Segment
        raised
        className="settings-section"
        style={{
          background: 'rgba(15, 23, 42, 0.3)',
          border: '1px solid var(--panel-border)',
          borderRadius: '12px',
          padding: '24px',
          margin: '0 0 24px 0',
        }}
      >
        <Header
          as="h3"
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-high)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            paddingBottom: '8px',
            margin: '0 0 16px 0',
          }}
        >
          Trash Retention
        </Header>

        <Form style={{ background: 'transparent' }}>
          <Form.Field
            label={{
              content: 'Auto-Cleanup Period',
              style: {
                color: 'var(--text-med)',
                fontSize: '13px',
                fontWeight: 500,
              },
            }}
            control="select"
            className="ui dropdown"
            value={config?.trash_retention_days ?? 30}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              handleUpdateTrashRetention(Number(e.target.value))
            }
            disabled={saving}
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-high)',
              padding: '10px 12px',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none',
              width: '100%',
            }}
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days (Default)</option>
            <option value={90}>90 days</option>
          </Form.Field>
          <p style={{ fontSize: '12px', color: 'var(--text-low)', marginTop: '8px', margin: 0 }}>
            Deleted projects and tasks will be kept in the trash and permanently purged from the
            database after the selected retention period.
          </p>
        </Form>
      </Segment>

      {/* Session Controls */}
      <Segment
        raised
        className="settings-section"
        style={{
          background: 'rgba(15, 23, 42, 0.3)',
          border: '1px solid var(--panel-border)',
          borderRadius: '12px',
          padding: '24px',
          margin: '0 0 24px 0',
        }}
      >
        <Header
          as="h3"
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-high)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            paddingBottom: '8px',
            margin: '0 0 16px 0',
          }}
        >
          Manual Control
        </Header>
        <p style={{ fontSize: '13px', color: 'var(--text-med)', marginBottom: '16px' }}>
          Lock your workspace immediately. You will need to re-authenticate to decrypt the database.
        </p>
        <Button
          negative
          basic
          onClick={handleManualLock}
          style={{ width: 'fit-content', borderRadius: '8px' }}
        >
          <Icon name="lock" /> Lock Database Now
        </Button>
      </Segment>

      {message && (
        <Message success size="small" style={{ textAlign: 'center', marginTop: '16px' }}>
          {message}
        </Message>
      )}
    </Container>
  );
};
