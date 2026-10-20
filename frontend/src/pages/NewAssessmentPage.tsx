import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { validateEmail } from '../components/FormField';
import { Icon } from '../components/Icon';
import { OtpInput } from '../components/OtpInput';
import { ErrorNotice, Notice } from '../components/States';
import { config } from '../config';
import { useCountdown } from '../hooks/useCountdown';
import { ApiError } from '../services/apiClient';
import { api } from '../services/api';
import { cn } from '../utils/cn';
import { formatElapsed } from '../utils/format';
import { KNOWN_SOURCES } from '../utils/report';

type Step = 'target' | 'otp' | 'verified';
type Busy = null | 'send' | 'verify' | 'scan';

/** Client-side pause between resend clicks (UX only; the server enforces 5 requests/hour per IP). */
const RESEND_COOLDOWN_MS = 30000;

const STEPS: Array<{ key: Step; title: string }> = [
  { key: 'target', title: 'Target specification' },
  { key: 'otp', title: 'Ownership challenge' },
  { key: 'verified', title: 'Launch assessment' },
];

export function NewAssessmentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const needsVerification = Boolean((location.state as { needsVerification?: boolean } | null)?.needsVerification);

  const [step, setStep] = useState<Step>('target');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [devModeWarning, setDevModeWarning] = useState(false);
  const [devBannerOpen, setDevBannerOpen] = useState(true);

  const secondsLeft = useCountdown(expiresAt);
  const resendIn = useCountdown(resendAt);
  const target = email.trim();

  useEffect(() => {
    if (needsVerification && target) {
      setError({
        title: 'Verification required',
        message: `${target} hasn't been verified for your account yet. Send a verification code to continue.`,
      });
    }
    // Runs once: explains the redirect from "Run again" when POST /scans returned 403.
  }, []);

  const resetToTarget = () => {
    setStep('target');
    setCode('');
    setCodeInvalid(false);
    setExpiresAt(null);
    setDevOtp(null);
    setError(null);
  };

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    const invalid = validateEmail(target);
    setEmailError(invalid);
    if (invalid) return;

    setBusy('send');
    setError(null);
    try {
      const res = await api.requestOtp(target);
      setExpiresAt(Date.now() + res.expires_in_minutes * 60_000);
      setResendAt(Date.now() + RESEND_COOLDOWN_MS);
      setCode('');
      setCodeInvalid(false);
      setDevBannerOpen(true);
      // Never keep the code outside an explicitly enabled dev build.
      setDevOtp(config.showDevOtp && res.dev_otp ? res.dev_otp : null);
      setDevModeWarning(!import.meta.env.DEV && Boolean(res.dev_otp));
      setStep('otp');
    } catch (err) {
      setError({ title: "Couldn't send a code", message: err instanceof ApiError ? err.message : 'Request failed.' });
    } finally {
      setBusy(null);
    }
  };

  const verify = async (value = code) => {
    if (value.length !== config.otpLength || busy) return;
    setBusy('verify');
    setError(null);
    try {
      await api.confirmOtp(target, value);
      setStep('verified');
      setDevOtp(null);
    } catch (err) {
      setCodeInvalid(true);
      if (err instanceof ApiError && err.status === 400) {
        setError({
          title: 'Code not accepted',
          message:
            'The code is wrong, has expired, or has been locked after 5 failed attempts. Check the digits, or request a new code.',
        });
      } else {
        setError({ title: "Couldn't verify the code", message: err instanceof ApiError ? err.message : 'Request failed.' });
      }
    } finally {
      setBusy(null);
    }
  };

  const startScan = async () => {
    setBusy('scan');
    setError(null);
    try {
      const scan = await api.createScan(target);
      navigate(`/scans/${scan.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setStep('target');
        setError({ title: 'Verification required', message: `The server hasn't recorded ${target} as verified for your account. Send a verification code first.` });
      } else {
        setError({ title: "Couldn't start the assessment", message: err instanceof ApiError ? err.message : 'Request failed.' });
      }
      setBusy(null);
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const expired = step === 'otp' && expiresAt !== null && secondsLeft === 0;

  return (
    <div className="flex flex-col gap-space-lg w-full max-w-[960px] mx-auto">
      {/* Breadcrumb strip */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm text-on-surface-variant font-mono-sm text-mono-sm">
        <div className="flex items-center gap-space-xs">
          <span className="text-primary font-headline-sm text-headline-sm">{String(stepIndex + 1).padStart(2, '0')}</span>
          <span>/</span>
          <span className="uppercase tracking-wider">New assessment</span>
          <span>/</span>
          <span className="text-on-surface font-headline-sm text-headline-sm">{STEPS[stepIndex].title}</span>
        </div>
        <div className="flex items-center gap-space-xs">
          <span className="w-1.5 h-1.5 rounded-[9999px] bg-primary" />
          <span className="uppercase">Ownership verification required</span>
        </div>
      </div>

      {devOtp && devBannerOpen && step === 'otp' && (
        <div className="flex items-center justify-between gap-space-sm px-space-md py-space-sm bg-surface-container-high rounded-lg">
          <div className="flex items-center gap-space-sm min-w-0">
            <Icon name="terminal" className="text-primary text-[18px]" />
            <span className="font-mono-sm text-mono-sm text-on-surface">
              <strong className="text-primary tracking-wide">[DEV]</strong> Code returned by the API (OTP_DEV_MODE):
              <span className="bg-surface-container-lowest px-1.5 py-0.5 rounded text-primary font-mono-md text-mono-md ml-1 font-semibold">
                {devOtp}
              </span>
            </span>
          </div>
          <button type="button" aria-label="Dismiss banner" onClick={() => setDevBannerOpen(false)} className="text-on-surface-variant hover:text-on-surface p-1">
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>
      )}
      {devModeWarning && (
        <Notice tone="warning">
          The backend returned a development verification code, so it is running with OTP_DEV_MODE enabled. The code is not shown
          here. Disable OTP_DEV_MODE and configure SMTP for production.
        </Notice>
      )}

      {/* Stepper */}
      <ol className="bg-surface-container-low rounded-lg p-space-md grid grid-cols-1 md:grid-cols-3 gap-space-md items-center">
        {STEPS.map((s, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <li key={s.key} className={cn('flex items-center gap-space-sm', active && 'bg-surface-container px-space-sm py-2 rounded', !done && !active && 'opacity-60')}>
              <div
                className={cn(
                  'w-7 h-7 rounded flex items-center justify-center shrink-0 font-mono-sm text-mono-sm',
                  done && 'bg-primary-container text-on-primary-container',
                  active && 'bg-primary text-on-primary font-semibold',
                  !done && !active && 'bg-surface-container text-on-surface-variant',
                )}
              >
                {done ? <Icon name="check" className="text-[16px] font-bold" /> : String(i + 1).padStart(2, '0')}
              </div>
              <div className="flex flex-col min-w-0">
                <span className={cn('font-label-sm text-label-sm uppercase tracking-wider', active ? 'text-primary' : 'text-on-surface-variant')}>
                  Step {i + 1} · {done ? 'Done' : active ? 'In progress' : 'Pending'}
                </span>
                <span className={cn('font-headline-sm text-headline-sm truncate', active || done ? 'text-on-surface' : 'text-on-surface-variant')}>{s.title}</span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Main stage */}
      <div className="bg-surface-container-low rounded-xl p-space-lg md:p-space-xl flex flex-col gap-space-lg">
        {step === 'target' && (
          <form onSubmit={sendCode} noValidate className="flex flex-col gap-space-lg">
            <div className="flex flex-col gap-space-xs max-w-xl">
              <div className="flex items-center gap-space-xs text-on-surface-variant font-mono-sm text-mono-sm">
                <Icon name="alternate_email" className="text-[16px] text-primary" />
                <span>TARGET // EMAIL YOU CONTROL</span>
              </div>
              <h1 className="font-headline-xl-mobile text-headline-xl-mobile md:font-headline-xl md:text-headline-xl text-on-surface tracking-tight">
                Which email address should we assess?
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Tracewell only scans addresses whose ownership you prove. We'll send a one-time code to this inbox.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="target-email" className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">
                Email address
              </label>
              <input
                id="target-email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                }}
                placeholder="you@example.com"
                aria-invalid={emailError ? true : undefined}
                className={cn(
                  'h-11 px-3 rounded-control bg-panel border font-mono-lg text-mono-lg text-on-surface placeholder:text-[#6E7980] outline-none focus:border-lime focus:ring-1 focus:ring-lime',
                  emailError ? 'border-sev-critical/60' : 'border-line-strong',
                )}
              />
              {emailError && <span className="font-body-sm text-body-sm text-sev-critical">{emailError}</span>}
            </div>
            {error && <ErrorNotice title={error.title} message={error.message} />}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-space-md bg-surface-container/40 p-space-md rounded-lg">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Already verified this address? Verification doesn't expire, so you can{' '}
                <button
                  type="button"
                  className="text-primary hover:underline disabled:opacity-60"
                  disabled={busy !== null}
                  onClick={() => {
                    const invalid = validateEmail(target);
                    setEmailError(invalid);
                    if (!invalid) void startScan();
                  }}
                >
                  start the scan directly
                </button>
                .
              </span>
              <Button type="submit" variant="primary" size="lg" icon="send" loading={busy === 'send'} disabled={busy !== null}>
                Send verification code
              </Button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-space-md">
              <div className="flex flex-col gap-space-xs max-w-xl min-w-0">
                <div className="flex items-center gap-space-xs text-on-surface-variant font-mono-sm text-mono-sm">
                  <Icon name="verified_user" className="text-[16px] text-primary" />
                  <span>OWNERSHIP CHALLENGE // EMAILED CODE</span>
                </div>
                <h1 className="font-headline-xl-mobile text-headline-xl-mobile md:font-headline-xl md:text-headline-xl text-on-surface tracking-tight break-words">
                  Enter the {config.otpLength}-digit code sent to{' '}
                  <span className="text-primary font-mono-lg text-mono-lg font-medium break-all">{target}</span>
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Tracewell only scans addresses whose ownership you've proven. Check that inbox for the code.
                </p>
              </div>
              <div className="flex md:flex-col items-center md:items-end justify-between gap-1 shrink-0 bg-surface-container px-space-md py-space-sm rounded-lg">
                <span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">Code validity</span>
                <div className={cn('flex items-center gap-1.5 font-mono-lg text-mono-lg', expired ? 'text-sev-critical' : 'text-primary')}>
                  <Icon name="timer" className="text-[16px]" />
                  <span aria-live="polite">{expired ? 'Expired' : formatElapsed(secondsLeft * 1000)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center py-space-md gap-space-md">
              <OtpInput
                length={config.otpLength}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  setCodeInvalid(false);
                }}
                onComplete={(v) => void verify(v)}
                disabled={busy === 'verify' || expired}
                invalid={codeInvalid}
                autoFocus
              />
              <div className="flex items-center gap-space-xs text-on-surface-variant font-mono-sm text-mono-sm text-center">
                <Icon name="info" className="text-[16px]" />
                <span>
                  {expired
                    ? 'This code has expired. Request a new one.'
                    : code.length < config.otpLength
                      ? `Awaiting ${config.otpLength - code.length} more digit${config.otpLength - code.length === 1 ? '' : 's'}`
                      : 'Code complete'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-space-md bg-surface-container/40 p-space-md rounded-lg">
              <button type="button" onClick={resetToTarget} className="font-body-sm text-body-sm text-secondary hover:text-on-surface flex items-center gap-1.5 transition-colors">
                <Icon name="arrow_back" className="text-[16px]" />
                Use a different email address
              </button>
              <div className="flex items-center gap-space-sm w-full sm:w-auto justify-end">
                <Button size="lg" icon="sync" onClick={() => void sendCode()} loading={busy === 'send'} disabled={busy !== null || resendIn > 0}>
                  {resendIn > 0 ? `Resend code (${resendIn}s)` : 'Resend code'}
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  icon="verified"
                  onClick={() => void verify()}
                  loading={busy === 'verify'}
                  disabled={busy !== null || code.length !== config.otpLength || expired}
                >
                  Verify ownership
                </Button>
              </div>
            </div>
            {error && <ErrorNotice title={error.title} message={error.message} />}
          </>
        )}

        {step === 'verified' && (
          <>
            <div className="flex flex-col gap-space-xs max-w-xl">
              <div className="flex items-center gap-space-xs text-primary font-mono-sm text-mono-sm">
                <Icon name="verified" className="text-[16px]" />
                <span>OWNERSHIP VERIFIED</span>
              </div>
              <h1 className="font-headline-xl-mobile text-headline-xl-mobile md:font-headline-xl md:text-headline-xl text-on-surface tracking-tight break-words">
                Ready to assess <span className="text-primary font-mono-lg text-mono-lg font-medium break-all">{target}</span>
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                The scan runs in the background and queries {KNOWN_SOURCES.length} public sources in parallel. It usually finishes
                within a minute. You can leave the page and come back to it from History.
              </p>
            </div>
            {error && <ErrorNotice title={error.title} message={error.message} />}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-space-md bg-surface-container/40 p-space-md rounded-lg">
              <button type="button" onClick={resetToTarget} className="font-body-sm text-body-sm text-secondary hover:text-on-surface flex items-center gap-1.5 transition-colors">
                <Icon name="arrow_back" className="text-[16px]" />
                Assess a different email
              </button>
              <Button variant="primary" size="lg" icon="radar" onClick={startScan} loading={busy === 'scan'} disabled={busy !== null}>
                Start assessment
              </Button>
            </div>
          </>
        )}
      </div>

      {/* What we check */}
      <details className="group bg-surface-container-low rounded-xl overflow-hidden" open>
        <summary className="flex items-center justify-between gap-space-sm p-space-md cursor-pointer select-none bg-surface-container-low hover:bg-surface-container transition-colors list-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center text-primary shrink-0">
              <Icon name="travel_explore" className="text-[18px]" />
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-on-surface">What we check</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {KNOWN_SOURCES.length} free public sources, queried once verification is complete
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-xs text-on-surface-variant">
            <span className="hidden sm:inline font-mono-sm text-mono-sm uppercase text-primary">{KNOWN_SOURCES.length} sources</span>
            <Icon name="expand_more" className="text-[20px] transition-transform duration-200 group-open:rotate-180" />
          </div>
        </summary>
        <div className="p-space-md bg-surface-container-lowest">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-sm">
            {KNOWN_SOURCES.map((s) => (
              <div key={s.id} className="p-space-md rounded-lg bg-surface-container flex flex-col gap-space-xs hover:bg-surface-container-high transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-headline-sm text-headline-sm text-on-surface">{s.label}</span>
                  <Icon name={s.icon} className="text-primary text-[18px]" />
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{s.description}</p>
                <div className="font-mono-sm text-mono-sm text-secondary mt-auto pt-space-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-[9999px] bg-primary" />
                  <span>
                    {s.checks} · {s.scope === 'domain' ? 'email domain' : s.scope === 'username' ? 'email local part' : 'email'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </details>

      {/* Step 3 preview */}
      <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-sm min-w-0">
          <div className="w-10 h-10 rounded bg-surface-container-high flex items-center justify-center text-primary shrink-0">
            <Icon name="play_circle" className="text-[20px]" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-space-xs">
              <span className="font-headline-sm text-headline-sm text-on-surface">Launch</span>
              <span className="bg-surface-container-high px-1.5 py-0.5 rounded font-mono-sm text-mono-sm text-primary uppercase">
                {step === 'verified' ? 'Ready' : 'Locked'}
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
              {target ? (
                <>
                  {step === 'verified' ? 'Ready to assess ' : 'Assessment of '}
                  <span className="font-mono-sm text-mono-sm text-on-surface font-semibold">{target}</span>
                  {step === 'verified' ? '.' : ' unlocks after verification.'}
                </>
              ) : (
                'Enter an email address to begin.'
              )}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-space-md shrink-0 w-full sm:w-auto justify-end">
          <div className="flex flex-col text-right">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Rate limit</span>
            <span className="font-mono-sm text-mono-sm text-secondary">Scans are limited per hour by the server</span>
          </div>
          <div className="w-9 h-9 rounded bg-surface-container flex items-center justify-center text-on-surface-variant">
            <Icon name="speed" className="text-[18px]" />
          </div>
        </div>
      </div>

      <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
        Changed your mind? <Link to="/" className="text-primary hover:underline">Back to overview</Link>
      </p>
    </div>
  );
}
