import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/States';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center px-margin">
      <div className="bg-panel border border-line rounded-card w-full max-w-md">
        <EmptyState icon="search_off" title="Page not found" action={<ButtonLink to="/" variant="primary" icon="shield_with_heart">Go to overview</ButtonLink>}>
          The page you're looking for doesn't exist.
        </EmptyState>
      </div>
    </div>
  );
}
