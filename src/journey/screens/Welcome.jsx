import { useState } from 'react';
import { Shell, Card, Notice, useAction } from '../ui';

const PROMISES = [
  'Shared goals you both agree to, and each person’s part in them',
  'Our Future — the plans you’re building toward',
  'An optional weekly check-in',
];

/** Sign in with an emailed one-time code. No passwords. */
export function SignIn({ client, profileName, onExit }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, error, run] = useAction();

  const send = () => run(async () => {
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Enter your email address.');
    const { error: err } = await client.auth.signInWithOtp({ email: value, options: { shouldCreateUser: true } });
    if (err) {
      throw new Error(/seconds|rate|security purposes/i.test(err.message)
        ? 'Please wait a minute before asking for another code.'
        : 'We couldn’t send a code just now. Check the address and try again.');
    }
    setEmail(value);
    setCode('');
    setStep('code');
  });

  const verify = () => run(async () => {
    const token = code.replace(/\D/g, '');
    if (token.length < 6) throw new Error('Enter the code from the email.');
    const { error: err } = await client.auth.verifyOtp({ email, token, type: 'email' });
    if (err) throw new Error('That code didn’t work. Check it, or ask for a new one.');
  });

  return (
    <Shell title="Our Journey" lede="A private space for two people to grow — on their own and together." onBack={onExit} backLabel="Home" testid="journey-signin">
      <Card className="jr-hero">
        <ul className="jr-promise">
          {PROMISES.map(p => <li key={p}>{p}</li>)}
        </ul>
        <p className="jr-fine">
          Only what you add to a Journey is shared. Your habits, XP, Daily Log, ratings, notes and
          challenges stay on this phone. Personal Forge keeps working without signing in.
        </p>
      </Card>

      <Card title={step === 'email' ? 'Sign in with your email' : 'Enter your code'}>
        {step === 'email' ? (
          <form className="jr-form" onSubmit={e => { e.preventDefault(); send(); }}>
            <label className="jr-label" htmlFor="jr-email">Email</label>
            <input
              id="jr-email" className="jr-input" type="email" inputMode="email" autoComplete="email"
              placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
            <p className="jr-fine">
              No password: we email you a one-time code. You’ll be signed in on the <strong>{profileName}</strong> profile
              of this phone. Your account is yours, separate from the profile.
            </p>
          </form>
        ) : (
          <form className="jr-form" onSubmit={e => { e.preventDefault(); verify(); }}>
            <p className="jr-fine">We sent a code to <strong>{email}</strong>. It may take a minute to arrive.</p>
            <label className="jr-label" htmlFor="jr-code">Code</label>
            <input
              id="jr-code" className="jr-input jr-code" inputMode="numeric" autoComplete="one-time-code"
              maxLength={10} placeholder="123456" value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
            <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <div className="jr-row-links">
              <button type="button" className="jr-link" onClick={send} disabled={busy}>Send a new code</button>
              <button type="button" className="jr-link" onClick={() => { setStep('email'); setCode(''); }}>Use another email</button>
            </div>
          </form>
        )}
        <Notice text={error} />
      </Card>
    </Shell>
  );
}

/** The one thing other people will see: a username, and a name if you want. */
export function ChooseUsername({ j, onExit, email }) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [busy, error, run] = useAction();

  const save = () => run(async () => {
    await j.act('forge_claim_username', { p_username: username, p_display_name: name || null });
  });

  return (
    <Shell title="Choose a username" lede="Friends find you by typing your exact username. Nothing else about you is shown to anyone." onBack={onExit} backLabel="Home" testid="journey-username">
      <Card>
        <form className="jr-form" onSubmit={e => { e.preventDefault(); save(); }}>
          <label className="jr-label" htmlFor="jr-username">Username</label>
          <div className="jr-at">
            <span aria-hidden="true">@</span>
            <input
              id="jr-username" className="jr-input" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              maxLength={20} placeholder="yourname" value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            />
          </div>
          <p className="jr-fine">3–20 letters, numbers or _, starting with a letter.</p>
          <label className="jr-label" htmlFor="jr-display">Your name <span className="jr-optional">optional</span></label>
          <input
            id="jr-display" className="jr-input" maxLength={40} placeholder="What friends see"
            value={name} onChange={e => setName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-full" disabled={busy || username.length < 3}>
            {busy ? 'Saving…' : 'Continue'}
          </button>
          <Notice text={error} />
        </form>
      </Card>
      <p className="jr-fine jr-center">Signed in as {email}. <button type="button" className="jr-inline" onClick={j.signOut}>Sign out</button></p>
    </Shell>
  );
}

export function NotConfigured({ onExit }) {
  return (
    <Shell title="Our Journey" onBack={onExit} backLabel="Home" testid="journey-unconfigured">
      <Card>
        <p className="jr-text">Our Journey isn’t connected on this version of Forge yet. Everything personal works as usual.</p>
      </Card>
    </Shell>
  );
}
