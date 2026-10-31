import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronDown, Download, Pencil, RefreshCw, Search, Star, Trash2 } from 'lucide-react';
import { useDeleteDocument, useDocuments, useUpdateDocument } from '../hooks/useDocuments';
import { documentService, type Document } from '../services/documentService';
import { DOCUMENT_KINDS, editorPath, formatSize, kindOf } from '../utils/documentTypes';
import { groupByAge } from '../utils/groupByAge';
import type { DocumentsOutletContext } from '../pages/DocumentsPage';
import WelcomeCards from './WelcomeCards';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useConfirm } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { cn } from '@/lib/utils';
import type { DocumentType } from 'shared';

interface DocumentsListProps {
  /** Only this kind of document */
  type?: DocumentType;
  /** Only the starred documents */
  starred?: boolean;
}

const shortDate = (value: string) => new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
const time = (value: string) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const sameDay = (a: string) => new Date(a).toDateString() === new Date().toDateString();

/** The files of the open list, newest first and grouped by age, beside the details of the selected one. */
const DocumentsList: React.FC<DocumentsListProps> = ({ type, starred }) => {
  const { onNew, onUpload } = useOutletContext<DocumentsOutletContext>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<DocumentType | ''>('');
  const debounced = useDebouncedValue(search.trim(), 300);
  const activeType = type ?? (kindFilter || undefined);

  const { data, isLoading, isError, isFetching, refetch } = useDocuments({
    limit: 100,
    ...(activeType ? { type: activeType } : {}),
    ...(starred ? { starred: 'true' as const } : {}),
    ...(debounced ? { search: debounced } : {}),
  });
  const update = useUpdateDocument();
  const remove = useDeleteDocument();
  const documents = useMemo(() => data?.data ?? [], [data]);
  const groups = useMemo(() => groupByAge(documents), [documents]);

  const kind = type ? kindOf(type) : null;
  const heading = starred ? 'Starred' : kind ? `${kind.label} files` : 'Recent';
  const open = (doc: Document) => navigate(editorPath(doc.type, doc.id));

  const onDelete = async (doc: Document) => {
    const ok = await confirm({ title: `Delete "${doc.title}"?`, message: 'You will not be able to open it again.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    remove.mutate(doc.id, {
      onSuccess: () => showToast('Deleted', `"${doc.title}" was removed.`, 'success'),
      onError: (error) => showToast('Could not delete', error.message, 'error'),
    });
  };
  const onDownload = (doc: Document) => {
    documentService.download(doc.id).catch((error: Error) => showToast('Could not download', error.message, 'error'));
  };
  const onToggleStar = (doc: Document) => {
    update.mutate({ id: doc.id, dto: { starred: !doc.starred } }, { onError: (error) => showToast('Could not change the star', error.message, 'error') });
  };

  return (
    <div className="min-h-[calc(100vh-12rem)]">
      <section aria-label={heading} className="card-enterprise min-h-[calc(100vh-12rem)] min-w-0">
        {!starred && !type && <WelcomeCards onNew={onNew} onUpload={onUpload} />}

        <div className="flex flex-col gap-3 px-4 pb-3 pt-4 sm:px-5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{heading}</h2>
            <button type="button" onClick={() => void refetch()} className="btn-icon" aria-label="Refresh the list" title="Refresh"><RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} /></button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {type ? <span /> : (
              <div className="relative sm:w-44">
                <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as DocumentType | '')} aria-label="Filter by type" className="input appearance-none pr-8">
                  <option value="">All types</option>
                  {DOCUMENT_KINDS.map((k) => <option key={k.type} value={k.type}>{k.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            )}
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9" placeholder="Search for documents" aria-label="Search for documents" />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16"><LoadingSpinner variant="invoices" size="sm" /></div>
        ) : isError ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm text-muted-foreground">The documents could not be loaded.</p>
            <button type="button" onClick={() => void refetch()} className="btn-ghost mt-3">Try again</button>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-3 flex -space-x-2">{DOCUMENT_KINDS.map((k) => <span key={k.type} className={cn('flex h-10 w-10 items-center justify-center rounded-full border-2 border-card', k.tint)}><k.icon className="h-4 w-4" /></span>)}</div>
            <h3 className="text-base font-semibold">{debounced ? 'Nothing matches your search' : starred ? 'No starred documents' : kind ? `No ${kind.label} files yet` : 'No documents yet'}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {debounced ? 'Try another name.' : starred ? 'Star a document to find it here quickly.' : 'Create a document with New, or bring a file with Open.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-y bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold sm:px-5">Name</th>
                  <th className="hidden px-3 py-2.5 text-left font-semibold md:table-cell">Type</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Last modified</th>
                  <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">Size</th>
                  <th className="px-3 py-2.5 text-right font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.label}>
                  <tr><th colSpan={5} scope="colgroup" className="px-4 pb-1 pt-4 text-left text-sm font-semibold sm:px-5">{group.label}</th></tr>
                  {group.documents.map((doc) => {
                    const k = kindOf(doc.type);
                    return (
                      <tr key={doc.id} onDoubleClick={() => open(doc)} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                        <td className="px-4 py-2.5 sm:px-5">
                          <div className="flex items-center gap-3">
                            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', k.tint)}><k.icon className="h-4 w-4" /></span>
                            <button type="button" onClick={(e) => { e.stopPropagation(); open(doc); }} className="min-w-0 text-left font-medium hover:underline"><span className="line-clamp-2 break-words">{doc.title}</span></button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); onToggleStar(doc); }} aria-label={doc.starred ? `Unstar ${doc.title}` : `Star ${doc.title}`} aria-pressed={doc.starred} className="shrink-0 rounded p-1 text-muted-foreground hover:text-amber-500">
                              <Star className={cn('h-4 w-4', doc.starred && 'fill-amber-400 text-amber-500')} />
                            </button>
                          </div>
                        </td>
                        <td className="hidden px-3 py-2.5 md:table-cell"><span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', k.tint)}>{k.label}</span></td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{sameDay(doc.updatedAt) ? time(doc.updatedAt) : shortDate(doc.updatedAt)}</td>
                        <td className="hidden whitespace-nowrap px-3 py-2.5 text-right text-muted-foreground sm:table-cell">{formatSize(doc.size)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={(e) => { e.stopPropagation(); open(doc); }} className="btn-icon" aria-label={`Edit ${doc.title}`} title="Edit"><Pencil className="h-4 w-4" /></button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); onDownload(doc); }} className="btn-icon" aria-label={`Download ${doc.title}`} title={`Download .${k.extension}`}><Download className="h-4 w-4" /></button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); void onDelete(doc); }} className="btn-icon hover:text-destructive" aria-label={`Delete ${doc.title}`} title="Delete"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </section>

    </div>
  );
};

export default DocumentsList;
