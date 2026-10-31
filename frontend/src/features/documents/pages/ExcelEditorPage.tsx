import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Workbook, type WorkbookInstance } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { transformExcelToFortune, transformFortuneToExcel } from '@corbe30/fortune-excel';
import { Download } from 'lucide-react';
import EditorHeader from '../components/EditorHeader';
import { useAutosave } from '../hooks/useAutosave';
import { useDocument, useSaveDocumentFile, useUpdateDocument } from '../hooks/useDocuments';
import { documentService, type Document } from '../services/documentService';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/toast';

type Sheets = React.ComponentProps<typeof Workbook>['data'];
type ExportType = NonNullable<Parameters<typeof transformFortuneToExcel>[1]>;
const XLSX = 'xlsx' as ExportType;

const BLANK: Sheets = [{ name: 'Sheet1', celldata: [], order: 0, row: 60, column: 26, status: 1 }] as Sheets;

/**
 * The spreadsheet reports its cells as a full grid, but it opens a sheet from a list of filled cells. This turns the
 * saved grid back into that list (a sheet that already has one is left as it is).
 */
export function gridToCells(sheets: Sheets): Sheets {
  return (sheets as unknown as Record<string, unknown>[]).map((sheet) => {
    const grid = sheet['data'] as unknown[][] | undefined;
    if (!Array.isArray(grid) || sheet['celldata']) return sheet;
    const celldata: { r: number; c: number; v: unknown }[] = [];
    grid.forEach((row, r) => (Array.isArray(row) ? row.forEach((cell, c) => { if (cell) celldata.push({ r, c, v: cell }); }) : undefined));
    const { data: _grid, ...rest } = sheet;
    void _grid;
    return { ...rest, celldata };
  }) as unknown as Sheets;
}

/** The sheets saved with the document, or nothing when it was never edited (or the saved copy is damaged). */
function savedSheets(doc: Document): Sheets | null {
  if (!doc.content) return null;
  try {
    const parsed: unknown = JSON.parse(doc.content);
    return Array.isArray(parsed) && parsed.length > 0 ? gridToCells(parsed as Sheets) : null;
  } catch {
    return null;
  }
}

interface ExcelEditorProps {
  doc: Document;
  initial: Sheets;
}

const ExcelEditor: React.FC<ExcelEditorProps> = ({ doc, initial }) => {
  const { showToast } = useToast();
  const update = useUpdateDocument();
  const saveFile = useSaveDocumentFile();
  const sheetRef = useRef<WorkbookInstance>(null);
  const [sheets] = useState<Sheets>(initial);
  const latest = useRef<Sheets>(initial);
  const title = useRef(doc.title);
  // What the sheets looked like when they were last saved (or first shown). Only a different state counts as a change:
  // the spreadsheet also reports itself when it opens, and again after it is exported, and those are not edits.
  const baseline = useRef<string | null>(null);
  const current = useRef('');

  const { status, markDirty, flush } = useAutosave(async () => {
    const all = (sheetRef.current?.getAllSheets() ?? latest.current) as Sheets;
    const json = JSON.stringify(all);
    await update.mutateAsync({ id: doc.id, dto: { title: title.current, content: json } });
    // the real .xlsx is saved too, so the file in the list always matches what is on screen
    const blob = await transformFortuneToExcel(sheetRef, XLSX, false);
    await saveFile.mutateAsync({ id: doc.id, file: blob, filename: `${title.current}.xlsx` });
    baseline.current = json;
  }, 2500);

  // if the spreadsheet did not report itself on opening, its state a moment after opening is the baseline
  useEffect(() => {
    const id = setTimeout(() => { baseline.current ??= JSON.stringify(sheetRef.current?.getAllSheets() ?? latest.current); }, 1200);
    return () => clearTimeout(id);
  }, []);

  const onSheetsChange = (data: Sheets) => {
    latest.current = data;
    current.current = JSON.stringify(data);
    if (baseline.current === null) baseline.current = current.current; // the first report is the opened file, not an edit
    else if (current.current !== baseline.current) markDirty();
  };

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
      <EditorHeader type="EXCEL" title={doc.title} status={status} onTitleChange={(next) => { title.current = next; markDirty(); }} onSave={() => void flush()}>
        <button type="button" onClick={() => void download()} className="btn-brand"><Download className="h-4 w-4" /> Download .xlsx</button>
      </EditorHeader>
      <div className="h-[calc(100vh-13rem)] min-h-[440px] overflow-hidden rounded-xl border border-border bg-white" aria-label="Spreadsheet">
        <Workbook
          ref={sheetRef as React.ComponentProps<typeof Workbook>['ref']}
          data={sheets}
          onChange={(data) => onSheetsChange(data as Sheets)}
          lang="en"
          showFormulaBar
          allowEdit
        />
      </div>
    </div>
  );
};

export default function ExcelEditorPage() {
  const { id } = useParams();
  const { data: doc, isLoading, isError } = useDocument(id);
  const [initial, setInitial] = useState<Sheets | null>(null);
  const [failed, setFailed] = useState(false);

  const docRef = useRef(doc);
  docRef.current = doc;
  const openId = doc?.type === 'EXCEL' ? doc.id : null;

  // opened once per document: a refreshed copy of the same document must not reopen the spreadsheet
  useEffect(() => {
    const doc = docRef.current;
    if (!doc || openId === null) return;
    const saved = savedSheets(doc);
    if (saved) { setInitial(saved); return; }
    // never edited here: open the stored .xlsx (an uploaded file, or a new blank workbook)
    let cancelled = false;
    void (async () => {
      try {
        const { blob } = await documentService.getFile(doc.id);
        let converted: Sheets | null = null;
        await transformExcelToFortune(new File([blob], `${doc.title}.xlsx`), (value: Sheets) => { converted = value; }, () => undefined, { current: null });
        if (!cancelled) setInitial(converted && (converted as unknown[]).length > 0 ? converted : BLANK);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [openId]);

  if (isLoading || (!initial && !failed && doc)) return <div className="py-24"><LoadingSpinner variant="invoices" size="sm" message="Opening your spreadsheet…" /></div>;
  if (isError || !doc || doc.type !== 'EXCEL' || failed || !initial) return <p className="py-24 text-center text-sm text-muted-foreground">This spreadsheet could not be opened.</p>;
  return <ExcelEditor doc={doc} initial={initial} />;
}
