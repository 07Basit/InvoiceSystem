import { useRef } from 'react';
import { useParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Download } from 'lucide-react';
import EditorHeader from '../components/EditorHeader';
import WordToolbar from '../components/WordToolbar';
import { useAutosave } from '../hooks/useAutosave';
import { useDocument, useUpdateDocument } from '../hooks/useDocuments';
import { documentService, type Document } from '../services/documentService';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/toast';

interface WordEditorProps {
  doc: Document;
}

/** The editor itself; it is only mounted once the document has loaded, so it starts with the saved text. */
const WordEditor: React.FC<WordEditorProps> = ({ doc }) => {
  const { showToast } = useToast();
  const update = useUpdateDocument();
  const html = useRef(doc.content ?? '');
  const title = useRef(doc.title);

  const { status, markDirty, flush } = useAutosave(async () => {
    await update.mutateAsync({ id: doc.id, dto: { title: title.current, content: html.current } });
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
      TextStyle, Color, FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TableKit.configure({ table: { resizable: true } }),
      Image.configure({ allowBase64: true }),
      Placeholder.configure({ placeholder: 'Start typing…' }),
    ],
    content: doc.content ?? '',
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { 'aria-label': 'Document text', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: e }) => { html.current = e.getHTML(); markDirty(); },
  });

  const onTitle = (next: string) => { title.current = next; markDirty(); };

  const download = async () => {
    try {
      await flush();
      await documentService.download(doc.id);
    } catch (error) {
      showToast('Could not download', (error as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <EditorHeader type="WORD" title={doc.title} status={status} onTitleChange={onTitle} onSave={() => void flush()}>
        <button type="button" onClick={() => void download()} className="btn-brand"><Download className="h-4 w-4" /> Download .docx</button>
      </EditorHeader>
      {editor && <WordToolbar editor={editor} onError={(m) => showToast('Picture not added', m, 'error')} />}
      <div className="doc-page doc-editor mx-auto w-full max-w-[860px] rounded-lg px-6 py-8 sm:px-14 sm:py-12">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default function WordEditorPage() {
  const { id } = useParams();
  const { data, isLoading, isError } = useDocument(id);
  if (isLoading) return <div className="py-24"><LoadingSpinner variant="invoice" size="sm" message="Opening your document…" /></div>;
  if (isError || !data || data.type !== 'WORD') return <p className="py-24 text-center text-sm text-muted-foreground">This Word document could not be opened.</p>;
  return <WordEditor doc={data} />;
}
