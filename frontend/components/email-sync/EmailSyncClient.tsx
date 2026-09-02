'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { EmailConnectionStatus, EmailPollResult } from '@/lib/types';

const PRESETS = [
  { label: 'Gmail', imapHost: 'imap.gmail.com', imapPort: 993 },
  { label: 'Outlook / Microsoft 365', imapHost: 'outlook.office365.com', imapPort: 993 },
  { label: 'Yahoo', imapHost: 'imap.mail.yahoo.com', imapPort: 993 },
  { label: 'Custom', imapHost: '', imapPort: 993 },
];

export function EmailSyncClient({ initialStatus }: { initialStatus: EmailConnectionStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [preset, setPreset] = useState(PRESETS[0].label);
  const [imapHost, setImapHost] = useState(PRESETS[0].imapHost);
  const [imapPort, setImapPort] = useState(String(PRESETS[0].imapPort));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollResult, setPollResult] = useState<EmailPollResult | null>(null);

  function selectPreset(label: string) {
    setPreset(label);
    const p = PRESETS.find((p) => p.label === label);
    if (p) { setImapHost(p.imapHost); setImapPort(String(p.imapPort)); }
  }

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      const saved = await api.post<EmailConnectionStatus>('email-connection', {
        imapHost, imapPort: Number(imapPort), imapSecure: true, username, password,
      });
      setStatus(saved);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to this mailbox.');
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    await api.delete('email-connection');
    setStatus({ connected: false, imapHost: null, username: null, status: null, lastError: null, lastPolledAt: null });
  }

  async function pollNow() {
    setPolling(true);
    setError(null);
    setPollResult(null);
    try {
      const result = await api.post<EmailPollResult>('email-connection/poll');
      setPollResult(result);
      const refreshed = await api.get<EmailConnectionStatus>('email-connection');
      setStatus(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check for replies.');
    } finally {
      setPolling(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Connection</p>
        {status.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge tone={status.status === 'error' ? 'breach' : 'positive'}>{status.status === 'error' ? 'Error' : 'Connected'}</Badge>
              <span className="text-sm text-ink-100">{status.username}</span>
              <span className="text-xs text-ink-500">({status.imapHost})</span>
            </div>
            {status.lastError && <p className="text-sm text-rust-400">{status.lastError}</p>}
            <p className="text-xs text-ink-500">Last checked: {status.lastPolledAt ? formatDate(status.lastPolledAt) : 'never'}</p>
            <div className="flex gap-3">
              <Button onClick={pollNow} disabled={polling} className="px-4 py-2 text-xs">
                {polling ? 'Checking…' : 'Check for replies now'}
              </Button>
              <Button variant="ghost" onClick={disconnect} className="px-4 py-2 text-xs text-rust-400">Disconnect</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-400">
              Connect your own mailbox so the platform can detect provider replies automatically. Uses IMAP with an
              app-specific password — not the account password itself, and no Google/Microsoft developer app to set
              up. Checked automatically every 10 minutes, or on demand below.
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.label} onClick={() => selectPreset(p.label)}
                  className={`rounded-sm border px-3 py-1 text-xs ${preset === p.label ? 'border-brass-500 text-brass-400' : 'border-hairline text-ink-300 hover:text-ink-100'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="IMAP host" value={imapHost} onChange={setImapHost} placeholder="imap.gmail.com" />
              <Field label="Port" value={imapPort} onChange={setImapPort} type="number" />
              <Field label="Email address" value={username} onChange={setUsername} placeholder="you@firm.com" />
              <Field label="App password" value={password} onChange={setPassword} type="password" placeholder="16-character app password" />
            </div>
            <Button onClick={connect} disabled={connecting || !imapHost || !username || !password} className="px-4 py-2 text-xs">
              {connecting ? 'Connecting…' : 'Connect mailbox'}
            </Button>
            {error && <p className="text-xs text-rust-400">{error}</p>}
            <p className="text-xs text-ink-500">
              Gmail: Google Account → Security → 2-Step Verification → App passwords. Outlook/Microsoft 365: account
              security settings → App passwords (some organisation tenants disable these — check with your IT admin
              if the connection is rejected).
            </p>
          </div>
        )}
      </Card>

      {pollResult && (
        <Card>
          <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Last check result</p>
          <p className="text-sm text-ink-100">
            Scanned {pollResult.messagesScanned} unread message(s) — {pollResult.matched.length} matched to a provider
            send, {pollResult.unmatched} unmatched (no reference code found).
          </p>
          {pollResult.error && <p className="mt-1 text-sm text-rust-400">{pollResult.error}</p>}
          {pollResult.matched.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-ink-100">
              {pollResult.matched.map((m) => (
                <li key={m.actionId}>• Household {m.householdId.slice(0, 8)} — {m.documentsAdded} attachment(s) processed, status set to RECEIVED</li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">{label}</span>
      <input
        type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
      />
    </label>
  );
}
