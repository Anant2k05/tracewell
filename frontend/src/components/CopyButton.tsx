import { useState } from 'react';
import { Icon } from './Icon';

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context / denied): nothing to do.
    }
  };
  return (
    <button type="button" onClick={copy} title={copied ? 'Copied' : label} aria-label={label} className="text-on-surface-variant hover:text-on-surface transition-colors">
      <Icon name={copied ? 'check' : 'content_copy'} className="text-[16px]" />
    </button>
  );
}
