import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../services/apiClient';
import { api } from '../services/api';

/**
 * Starts a scan for an email the user has verified before. The backend keeps
 * verifications indefinitely, so POST /scans succeeds directly for those. If
 * it answers 403 (not verified for this account), the user is sent to the
 * verification flow with the email prefilled.
 */
export function useRunScan() {
  const navigate = useNavigate();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (email: string) => {
      setPendingEmail(email);
      setError(null);
      try {
        const scan = await api.createScan(email);
        navigate(`/scans/${scan.id}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          navigate(`/assess?email=${encodeURIComponent(email)}`, { state: { needsVerification: true } });
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Could not start the scan.');
      } finally {
        setPendingEmail(null);
      }
    },
    [navigate],
  );

  return { run, pendingEmail, error, clearError: () => setError(null) };
}
