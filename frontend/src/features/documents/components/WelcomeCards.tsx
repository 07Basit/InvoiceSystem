import { useState } from 'react';
import { FolderOpen, X } from 'lucide-react';
import { DOCUMENT_KINDS } from '../utils/documentTypes';
import { cn } from '@/lib/utils';
import type { DocumentType } from 'shared';

const KEY = 'documents.welcome.hidden';

const wasHidden = () => {
  try { return window.localStorage.getItem(KEY) === '1'; } catch { return false; }
};

interface WelcomeCardsProps {
  onNew: (type: DocumentType) => void;
  onUpload: () => void;
}

/** Quick ways to start, above the recent files. They can be closed, and stay closed. */
const WelcomeCards: React.FC<WelcomeCardsProps> = ({ onNew, onUpload }) => {
  const [hidden, setHidden] = useState(wasHidden);
  if (hidden) return null;
  const close = () => {
    setHidden(true);
    try { window.localStorage.setItem(KEY, '1'); } catch { /* the cards just come back next time */ }
  };
  return (
    <section aria-label="Start something new" className="px-4 pb-2 pt-4 sm:px-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Start something new</h2>
        <button type="button" onClick={close} className="btn-icon -mr-2" aria-label="Close these shortcuts"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {DOCUMENT_KINDS.map((kind) => {
          const Icon = kind.icon;
          return (
            <button key={kind.type} type="button" onClick={() => onNew(kind.type)} className="group rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40">
              <span className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg', kind.tint)}><Icon className="h-4 w-4" /></span>
              <span className="block text-sm font-semibold">New {kind.singular}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{kind.newHint}</span>
            </button>
          );
        })}
        <button type="button" onClick={onUpload} className="group rounded-xl border border-dashed border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40">
          <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><FolderOpen className="h-4 w-4" /></span>
          <span className="block text-sm font-semibold">Open a file</span>
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">Bring a PDF, Word or Excel file from your computer.</span>
        </button>
      </div>
    </section>
  );
};

export default WelcomeCards;
