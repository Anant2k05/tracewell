import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../components/Button';
import { FormField, validateEmail } from '../components/FormField';
import { ErrorNotice, Notice } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../layouts/AuthLayout';
import type { LoginRedirectState } from '../layouts/RouteGuards';
import { ApiError } from '../services/apiClient';

export function LoginPage() {
  const { login, sessionExpired, acknowledgeExpiry } = useAuth();
  const location = useLocation();
  const state = location.state as LoginRedirectState | null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = { email: validateEmail(email), password: password ? null : 'Enter your password.' };
    setFieldErrors(errs);
    if (errs.email || errs.password) return;

    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      acknowledgeExpiry();
      // <PublicOnly> redirects to the original destination once the session exists.
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('This account is disabled.');
      else setError(err instanceof ApiError ? err.message : 'Sign-in failed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Access your exposure assessments and verified email addresses."
      footer={
        <>
          No account yet?{' '}
          <Link to="/register" className="text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      {sessionExpired && (
        <Notice tone="warning" icon="schedule" onDismiss={acknowledgeExpiry}>
          Your session expired. Sign in again to continue.
        </Notice>
      )}
      {state?.notice && <Notice tone="info">{state.notice}</Notice>}
      <form className="flex flex-col gap-space-md" onSubmit={onSubmit} noValidate>
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          autoFocus
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        {error && <ErrorNotice title="Couldn't sign in" message={error} />}
        <Button type="submit" variant="primary" size="lg" icon="login" loading={submitting} className="w-full">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
