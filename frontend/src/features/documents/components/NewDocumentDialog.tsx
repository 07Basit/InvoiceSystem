import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { kindOf } from '../utils/documentTypes';
import type { DocumentType } from 'shared';

interface NewDocumentDialogProps {
  type: DocumentType;
  busy: boolean;
  onCreate: (title: string, content: string) => void;
  onClose: () => void;
}

/** Asks for a name (and, for a PDF, optionally the text it starts from) before a new document is made. */
const NewDocumentDialog: React.FC<NewDocumentDialogProps> = ({ type, busy, onCreate, onClose }) => {
  const kind = kindOf(type);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) onCreate(title.trim(), text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`New ${kind.singular}`}>
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">New {kind.singular}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{kind.newHint}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-icon -mr-2 -mt-1" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <label className="label" htmlFor="doc-title">Name</label>
        <input id="doc-title" ref={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="input" placeholder={`e.g. Price list October`} />
        {type === 'PDF' && (
          <div className="mt-4">
            <label className="label" htmlFor="doc-text">Text (optional)</label>
            <textarea id="doc-text" value={text} onChange={(e) => setText(e.target.value)} rows={6} className="input resize-y" placeholder="Type or paste the text for the PDF" />
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={!title.trim() || busy} className="btn-brand disabled:opacity-50">{busy ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
};

export default NewDocumentDialog;
