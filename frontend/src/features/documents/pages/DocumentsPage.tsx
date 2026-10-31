import { useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import DocumentsSidebar from '../components/DocumentsSidebar';
import NewDocumentDialog from '../components/NewDocumentDialog';
import { useCreateDocument, useImportDocument } from '../hooks/useDocuments';
import { DOCUMENT_KINDS, editorPath, kindOf } from '../utils/documentTypes';
import { useToast } from '@/components/ui/toast';
import type { DocumentType } from 'shared';

const ACCEPT = DOCUMENT_KINDS.map((k) => k.accept).join(',');

/** What the lists inside the Documents area can ask for: start a new document, or bring in a file. */
export interface DocumentsOutletContext {
  onNew: (type: DocumentType) => void;
  onUpload: () => void;
}

/** The Documents area: a bar across the top (New, Open, Recent, Starred, file types) above whichever list is open. */
export default function DocumentsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const create = useCreateDocument();
  const importFile = useImportDocument();
  const [creating, setCreating] = useState<DocumentType | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const onCreate = (title: string, content: string) => {
    if (!creating) return;
    create.mutate({ title, type: creating, content }, {
      onSuccess: (created) => navigate(editorPath(creating, created.id)),
      onError: (error) => showToast(`Could not create the ${kindOf(creating).singular}`, error.message, 'error'),
    });
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    importFile.mutate({ file }, {
      onSuccess: (added) => { showToast('File added', `"${added.title}" is ready to edit.`, 'success'); navigate(editorPath(added.type, added.id)); },
      onError: (error) => showToast('Could not add the file', error.message, 'error'),
    });
  };

  const context: DocumentsOutletContext = { onNew: setCreating, onUpload: () => picker.current?.click() };

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Documents</h1>
      <input ref={picker} type="file" accept={ACCEPT} className="hidden" onChange={onPick} aria-label="Choose a file to open" />
      <DocumentsSidebar onNew={setCreating} onUpload={context.onUpload} uploading={importFile.isPending} />
      <Outlet context={context} />
      {creating && <NewDocumentDialog type={creating} busy={create.isPending} onCreate={onCreate} onClose={() => setCreating(null)} />}
    </div>
  );
}
