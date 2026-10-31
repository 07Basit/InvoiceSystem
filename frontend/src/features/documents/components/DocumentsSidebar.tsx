import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown, Clock, FolderOpen, Plus, Star } from 'lucide-react';
import { useDocumentCount } from '../hooks/useDocuments';
import { DOCUMENT_KINDS, listPath } from '../utils/documentTypes';
import { cn } from '@/lib/utils';
import type { DocumentType } from 'shared';

interface NavItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  filter?: { type?: DocumentType; starred?: boolean };
  end?: boolean;
  /** show the number of files beside the name */
  count?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, label, icon, filter, end, count }) => {
  const { data } = useDocumentCount(filter ?? {});
  return (
    <NavLink
      to={to}
      end={end ?? false}
      className={({ isActive }) =>
        cn(
          'flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      {count && data !== undefined && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums text-muted-foreground" aria-label={`${data} files`}>{data}</span>}
    </NavLink>
  );
};

interface DocumentsSidebarProps {
  onNew: (type: DocumentType) => void;
  onUpload: () => void;
  uploading: boolean;
}

/** The bar across the top of the Documents area: New and Open, then Recent, Starred and the file types. */
const DocumentsSidebar: React.FC<DocumentsSidebarProps> = ({ onNew, onUpload, uploading }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const away = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node)) setMenuOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [menuOpen]);

  return (
    <div role="group" aria-label="Documents menu" className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
      <div ref={menu} className="relative">
        <button type="button" onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen} className="btn-brand">
          <Plus className="h-4 w-4" /> New <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {menuOpen && (
          <div role="menu" className="absolute left-0 z-50 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-xl">
            {DOCUMENT_KINDS.map((k) => {
              const Icon = k.icon;
              return (
                <button key={k.type} type="button" role="menuitem" onClick={() => { setMenuOpen(false); onNew(k.type); }} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-md', k.tint)}><Icon className="h-3.5 w-3.5" /></span> New {k.singular}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <button type="button" onClick={onUpload} disabled={uploading} className="btn-ghost">
        <FolderOpen className="h-4 w-4" /> {uploading ? 'Opening…' : 'Open'}
      </button>

      <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

      <nav aria-label="Document lists" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        <NavItem to={listPath()} end label="Recent" icon={<Clock className="h-4 w-4" />} />
        <NavItem to={listPath('starred')} label="Starred" icon={<Star className="h-4 w-4" />} filter={{ starred: true }} count />
        <span className="mx-1 my-1.5 w-px shrink-0 bg-border" aria-hidden="true" />
        {DOCUMENT_KINDS.map((kind) => {
          const Icon = kind.icon;
          return <NavItem key={kind.type} to={listPath(kind.type)} label={kind.label} icon={<Icon className="h-4 w-4" />} filter={{ type: kind.type }} count />;
        })}
      </nav>
    </div>
  );
};

export default DocumentsSidebar;
