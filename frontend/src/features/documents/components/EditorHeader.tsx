import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, CloudOff, Loader2 } from 'lucide-react';
import type { SaveStatus } from '../hooks/useAutosave';
import type { DocumentType } from 'shared';

interface EditorHeaderProps {
  type: DocumentType;
  title: string;
  status: SaveStatus;
  onTitleChange: (title: string) => void;
  onSave: () => void;
  children?: ReactNode;
}

const STATUS_TEXT: Record<SaveStatus, string> = { saved: 'All changes saved', saving: 'Saving…', unsaved: 'Unsaved changes', error: 'Not saved' };

/** The bar above every editor: back to the list, the document's name, whether it is saved, and the editor's own buttons. */
const EditorHeader: React.FC<EditorHeaderProps> = ({ type, title, status, onTitleChange, onSave, children }) => {
  const [draft, setDraft] = useState(title);
  useEffect(() => setDraft(title), [title]);
  const commit = () => {
    const next = draft.trim();
    if (!next) setDraft(title);
    else if (next !== title) onTitleChange(next);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Link to={`/documents/${type.toLowerCase()}`} className="btn-icon shrink-0" aria-label="Back to documents" title="Back to documents"><ArrowLeft className="h-4 w-4" /></Link>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          maxLength={200}
          aria-label="Document name"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-lg font-semibold hover:border-border focus:border-border focus:bg-background focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
          {status === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status === 'error' ? <CloudOff className="h-3.5 w-3.5 text-destructive" /> : status === 'saved' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : null}
          {STATUS_TEXT[status]}
        </span>
        <button type="button" onClick={onSave} disabled={status === 'saved' || status === 'saving'} className="btn-ghost disabled:opacity-50">Save</button>
        {children}
      </div>
    </div>
  );
};

export default EditorHeader;
