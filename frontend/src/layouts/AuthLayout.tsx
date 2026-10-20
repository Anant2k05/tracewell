import type { ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';

/** Unauthenticated shell: centered Level-1 card on the canvas. */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-container-lowest flex flex-col">
      <header className="h-14 px-margin flex items-center border-b border-line bg-surface-container-low">
        <Logo />
      </header>
      <main className="flex-1 flex items-start sm:items-center justify-center px-margin py-space-xl">
        <div className="w-full max-w-[420px] flex flex-col gap-space-md">
          <div className="bg-panel border border-line rounded-card p-space-lg flex flex-col gap-space-lg">
            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center gap-space-xs text-on-surface-variant font-mono-sm text-mono-sm uppercase tracking-wider">
                <Icon name="verified_user" className="text-[16px] text-primary" />
                Personal exposure assessment
              </div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{title}</h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>
            </div>
            {children}
          </div>
          <div className="text-center font-body-sm text-body-sm text-on-surface-variant">{footer}</div>
          <p className="text-center font-mono-sm text-mono-sm text-[#6E7980]">
            Scans only run against email addresses you prove you control.
          </p>
        </div>
      </main>
    </div>
  );
}
