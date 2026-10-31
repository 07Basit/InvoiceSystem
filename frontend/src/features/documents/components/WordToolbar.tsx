import { useRef } from 'react';
import type { Editor } from '@tiptap/react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Eraser, Highlighter, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Strikethrough,
  Table as TableIcon, Underline, Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const ToolButton: React.FC<ToolButtonProps> = ({ label, active, disabled, onClick, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={active ?? false}
    disabled={disabled}
    // keeps the text selection while a toolbar button is used
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-accent disabled:opacity-40', active && 'bg-primary/10 text-primary')}
  >
    {children}
  </button>
);

const Divider = () => <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />;

const FONT_SIZES = ['10', '12', '14', '16', '18', '20', '24', '28', '36'];
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

interface WordToolbarProps {
  editor: Editor;
  onError: (message: string) => void;
}

/** Formatting buttons for the Word editor. */
const WordToolbar: React.FC<WordToolbarProps> = ({ editor, onError }) => {
  const picker = useRef<HTMLInputElement>(null);
  const chain = () => editor.chain().focus();
  const inTable = editor.isActive('table');

  const blockValue = editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p';
  const setBlock = (value: string) => {
    if (value === 'p') chain().setParagraph().run();
    else chain().setHeading({ level: Number(value[1]) as 1 | 2 | 3 }).run();
  };
  const fontSize = String(editor.getAttributes('textStyle')['fontSize'] ?? '').replace('px', '');

  const setLink = () => {
    const previous = (editor.getAttributes('link')['href'] as string | undefined) ?? '';
    const url = window.prompt('Link address (leave empty to remove the link)', previous);
    if (url === null) return;
    if (url.trim() === '') chain().extendMarkRange('link').unsetLink().run();
    else chain().extendMarkRange('link').setLink({ href: /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}` }).run();
  };

  const onImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g|gif)$/.test(file.type)) return onError('Choose a PNG, JPEG or GIF picture.');
    if (file.size > MAX_IMAGE_BYTES) return onError('That picture is larger than 3 MB.');
    const reader = new FileReader();
    reader.onload = () => chain().setImage({ src: String(reader.result) }).run();
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-card px-2 py-1.5" role="toolbar" aria-label="Formatting">
      <ToolButton label="Undo" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}><Undo2 className="h-4 w-4" /></ToolButton>
      <ToolButton label="Redo" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}><Redo2 className="h-4 w-4" /></ToolButton>
      <Divider />
      <select aria-label="Text style" value={blockValue} onChange={(e) => setBlock(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm">
        <option value="p">Normal</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <select
        aria-label="Font size"
        value={FONT_SIZES.includes(fontSize) ? fontSize : ''}
        onChange={(e) => (e.target.value ? chain().setFontSize(`${e.target.value}px`).run() : chain().unsetFontSize().run())}
        className="ml-1 h-8 rounded-md border bg-background px-2 text-sm"
      >
        <option value="">Size</option>
        {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <Divider />
      <ToolButton label="Bold" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}><Bold className="h-4 w-4" /></ToolButton>
      <ToolButton label="Italic" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolButton>
      <ToolButton label="Underline" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}><Underline className="h-4 w-4" /></ToolButton>
      <ToolButton label="Strikethrough" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></ToolButton>
      <label className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-accent" title="Text colour">
        <span className="text-sm font-bold" style={{ color: (editor.getAttributes('textStyle')['color'] as string | undefined) ?? 'currentColor' }}>A</span>
        <span className="absolute bottom-1 h-0.5 w-4 rounded bg-current opacity-60" aria-hidden="true" />
        <input type="color" aria-label="Text colour" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => chain().setColor(e.target.value).run()} />
      </label>
      <label className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-accent" title="Highlight colour">
        <Highlighter className="h-4 w-4" />
        <input type="color" aria-label="Highlight colour" defaultValue="#ffff00" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => chain().setHighlight({ color: e.target.value }).run()} />
      </label>
      <Divider />
      <ToolButton label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => chain().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></ToolButton>
      <ToolButton label="Align centre" active={editor.isActive({ textAlign: 'center' })} onClick={() => chain().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></ToolButton>
      <ToolButton label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => chain().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></ToolButton>
      <ToolButton label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => chain().setTextAlign('justify').run()}><AlignJustify className="h-4 w-4" /></ToolButton>
      <Divider />
      <ToolButton label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}><List className="h-4 w-4" /></ToolButton>
      <ToolButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolButton>
      <ToolButton label="Quote" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()}><Quote className="h-4 w-4" /></ToolButton>
      <ToolButton label="Divider line" onClick={() => chain().setHorizontalRule().run()}><Minus className="h-4 w-4" /></ToolButton>
      <Divider />
      <ToolButton label="Link" active={editor.isActive('link')} onClick={setLink}><Link2 className="h-4 w-4" /></ToolButton>
      <ToolButton label="Picture" onClick={() => picker.current?.click()}><ImagePlus className="h-4 w-4" /></ToolButton>
      <input ref={picker} type="file" accept="image/png,image/jpeg,image/gif" className="hidden" onChange={onImage} aria-label="Choose a picture" />
      <ToolButton label="Insert table" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="h-4 w-4" /></ToolButton>
      <ToolButton label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}><Eraser className="h-4 w-4" /></ToolButton>

      {inTable && (
        <div className="mt-1 flex w-full flex-wrap items-center gap-1 border-t pt-1.5 text-xs" aria-label="Table">
          <span className="mr-1 font-medium text-muted-foreground">Table</span>
          {[
            ['Add row above', () => chain().addRowBefore().run()],
            ['Add row below', () => chain().addRowAfter().run()],
            ['Add column left', () => chain().addColumnBefore().run()],
            ['Add column right', () => chain().addColumnAfter().run()],
            ['Delete row', () => chain().deleteRow().run()],
            ['Delete column', () => chain().deleteColumn().run()],
            ['Merge or split cells', () => chain().mergeOrSplit().run()],
            ['Delete table', () => chain().deleteTable().run()],
          ].map(([text, run]) => (
            <button key={text as string} type="button" onMouseDown={(e) => e.preventDefault()} onClick={run as () => void} className="rounded-md border px-2 py-1 hover:bg-accent">{text as string}</button>
          ))}
        </div>
      )}
    </div>
  );
};

export default WordToolbar;
