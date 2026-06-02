import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Grid, Segment, Form, Button, Checkbox, Message, Icon, Input } from 'semantic-ui-react';

interface LockScreenProps {
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saveInKeyring, setSaveInKeyring] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Try to auto-unlock using the saved keyring password on load
    const checkAutoUnlock = async () => {
      try {
        const success = await invoke<boolean>('unlock_db_with_saved_key');
        if (success) {
          onUnlock();
        } else {
          // If auto unlock fails/is disabled, check if this is the first run
          const firstRun = await invoke<boolean>('is_first_run');
          setIsFirstRun(firstRun);

          // Get config to see default keyring state
          const config = await invoke<{ keyring_enabled: boolean }>('get_config');
          setSaveInKeyring(config.keyring_enabled);
          setLoading(false);
        }
      } catch (err) {
        console.error('Auto unlock error:', err);
        setLoading(false);
      }
    };
    checkAutoUnlock();
  }, [onUnlock]);

  useEffect(() => {
    if (!loading) {
      passwordInputRef.current?.focus();
    }
  }, [loading]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter a master password.');
      return;
    }

    if (isFirstRun && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await invoke('unlock_db', { password, saveInKeyring });
      onUnlock();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="lock-screen-container">
        <Grid textAlign="center" style={{ height: '100vh', width: '100%' }} verticalAlign="middle">
          <Grid.Column style={{ maxWidth: 400 }}>
            <Segment
              raised
              padded="very"
              className="lock-card glass-panel"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-high)',
              }}
            >
              <div
                className="lock-icon-wrapper"
                style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}
              >
                <Icon name="spinner" loading size="large" />
              </div>
              <h2 style={{ color: 'var(--text-high)', marginTop: '16px' }}>Securing Database</h2>
              <p style={{ color: 'var(--text-med)' }}>Checking security credentials...</p>
            </Segment>
          </Grid.Column>
        </Grid>
      </div>
    );
  }

  return (
    <div className="lock-screen-container">
      <Grid textAlign="center" style={{ height: '100vh', width: '100%' }} verticalAlign="middle">
        <Grid.Column style={{ maxWidth: 400 }}>
          <Segment
            raised
            padded="very"
            className="lock-card glass-panel"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-high)',
              textAlign: 'center',
            }}
          >
            <div
              className="lock-icon-wrapper"
              style={{
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <Icon name="lock" size="large" style={{ color: 'var(--primary)' }} />
            </div>

            <h2 style={{ color: 'var(--text-high)', margin: '0 0 8px 0' }}>
              {isFirstRun ? 'Setup Master Password' : 'Memor Decryption'}
            </h2>
            <p style={{ color: 'var(--text-med)', fontSize: '14px', marginBottom: '24px' }}>
              {isFirstRun
                ? 'Create a master password to encrypt your local database. Keep this safe; it cannot be recovered.'
                : 'Enter your master password to decrypt your task database.'}
            </p>

            <Form size="large" onSubmit={handleUnlock} style={{ textAlign: 'left' }}>
              <Form.Field
                label={{
                  content: isFirstRun ? 'Choose Master Password' : 'Master Password',
                  style: {
                    color: 'var(--text-med)',
                    fontWeight: 500,
                    fontSize: '12px',
                    marginBottom: '6px',
                  },
                }}
                control={Input}
                id="master-password"
                type="password"
                inputRef={passwordInputRef}
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                fluid
              />

              {isFirstRun && (
                <Form.Field
                  label={{
                    content: 'Confirm Master Password',
                    style: {
                      color: 'var(--text-med)',
                      fontWeight: 500,
                      fontSize: '12px',
                      marginBottom: '6px',
                    },
                  }}
                  control={Input}
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setConfirmPassword(e.target.value)
                  }
                  placeholder="••••••••••••"
                  fluid
                />
              )}

              <Form.Field style={{ margin: '16px 0' }}>
                <Checkbox
                  id="keyring-checkbox"
                  label="Remember in system keyring"
                  checked={saveInKeyring}
                  onChange={(_, data) => setSaveInKeyring(Boolean(data.checked))}
                />
              </Form.Field>

              {error && (
                <Message
                  className="lock-error"
                  negative
                  size="small"
                  style={{ margin: '0 0 16px 0', padding: '10px 12px' }}
                >
                  <Message.Header style={{ fontSize: '13px', fontWeight: 600 }}>
                    Decryption Failed
                  </Message.Header>
                  <p style={{ fontSize: '12px', margin: 0 }}>{error}</p>
                </Message>
              )}

              <Button
                type="submit"
                primary
                fluid
                size="large"
                style={{ borderRadius: '8px', padding: '14px' }}
              >
                {isFirstRun ? 'Create & Initialize Database' : 'Decrypt Database'}
              </Button>
            </Form>
          </Segment>
        </Grid.Column>
      </Grid>
    </div>
  );
};
