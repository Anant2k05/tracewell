import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { FormField, validateEmail, validatePassword } from '../components/FormField';
import { ErrorNotice } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../layouts/AuthLayout';
import type { LoginRedirectState } from '../layouts/RouteGuards';
import { ApiError } from '../services/apiClient';

interface FieldErrors {
  email?: string | null;
  password?: string | null;
  confirm?: string | null;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: FieldErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
      confirm: confirm === password ? null : 'Passwords do not match.',
    };
    setFieldErrors(errs);
    if (errs.email || errs.password || errs.confirm) return;

    setSubmitting(true);
    setError(null);
    try {
      await register(email.trim(), password);
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError && err.status === 409) {
        setFieldErrors({ email: 'This email is already registered.' });
        return;
      }
      // Account created but the follow-up sign-in failed: send them to log in manually.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        const state: LoginRedirectState = { notice: 'Account created. Sign in to continue.' };
        navigate('/login', { replace: true, state });
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
    }
  };

  return (
    <AuthLayout
      title="Create account"
      subtitle="Register to run exposure assessments on email addresses you own."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          hint="8–128 characters, with at least one letter and one digit."
        />
        <FormField
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={fieldErrors.confirm}
        />
        {error && <ErrorNotice title="Couldn't create account" message={error} />}
        <Button type="submit" variant="primary" size="lg" icon="person_add" loading={submitting} className="w-full">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
