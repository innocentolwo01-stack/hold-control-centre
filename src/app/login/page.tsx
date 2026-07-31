'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button, Field, Input } from '@/components/ui';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard');
    });
  }, [router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setBusy(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === 'signup' && !result.data.session) {
      setMessage('Account created. Check your email to confirm it, then sign in.');
      return;
    }

    const nextPath =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('next')
        : null;

    router.replace(nextPath || '/dashboard');
  }

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="brand-mark">
          <span />
          <span />
        </div>
        <h1>
          Hold
          <br />
          Control Centre
        </h1>
        <p>
          Run rewards, partner integrations, unique barcode inventory,
          redemptions, users, notifications and app settings from one secure
          workspace.
        </p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <h2>
            {mode === 'login'
              ? 'Administrator sign in'
              : 'Create administrator account'}
          </h2>
          <p>Use the invited owner email for the first account.</p>

          <form className="login-form" onSubmit={submit}>
            <Field label="Email">
              <Input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
              />
            </Field>

            {error ? <div className="error">{error}</div> : null}
            {message ? <div className="success">{message}</div> : null}

            <Button disabled={busy}>
              {busy
                ? 'Please wait…'
                : mode === 'login'
                  ? 'Sign in'
                  : 'Create account'}
            </Button>
          </form>

          <div className="login-switch">
            {mode === 'login'
              ? 'First time here?'
              : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() =>
                setMode(mode === 'login' ? 'signup' : 'login')
              }
            >
              {mode === 'login' ? 'Create account' : 'Sign in'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
