import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import DocumentsPage from '../pages/DocumentsPage';
import DocumentsListPage from '../pages/DocumentsListPage';
import { documentService, type Document } from '../services/documentService';
import { renderRoutes } from '@/__tests__/utils';
import { ConfirmProvider } from '@/components/ui/confirm';

vi.mock('../services/documentService', () => ({
  documentService: { getAll: vi.fn(), create: vi.fn(), importFile: vi.fn(), delete: vi.fn(), download: vi.fn(), getById: vi.fn(), getFile: vi.fn(), update: vi.fn(), saveFile: vi.fn() },
}));
const service = vi.mocked(documentService);

const ago = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
const doc = (over: Partial<Document>): Document => ({ id: 'd1', title: 'Price list', type: 'WORD', size: 2048, starred: false, createdAt: ago(40), updatedAt: ago(0), ...over });
const ALL = [
  doc({}),
  doc({ id: 'd2', title: 'Packing sheet', type: 'EXCEL', size: 0, updatedAt: ago(3) }),
  doc({ id: 'd3', title: 'Scan', type: 'PDF', size: 4096, starred: true, updatedAt: ago(15) }),
  doc({ id: 'd4', title: 'Old letter', type: 'WORD', updatedAt: ago(90) }),
];
const reply = (data: Document[], limit: number) => ({ success: true, data: data.slice(0, limit), error: null, meta: { page: 1, limit, total: data.length, totalPages: 1, hasNext: false, hasPrev: false } }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  // the list, and the one-row queries that count each list for the side menu
  service.getAll.mockImplementation((async (q: { type?: string; starred?: string; limit?: number }) => {
    const rows = ALL.filter((d) => (!q.type || d.type === q.type) && (q.starred !== 'true' || d.starred));
    return reply(rows, q.limit ?? 20);
  }) as never);
});

const page = (route = '/documents') => renderRoutes(
  <ConfirmProvider>
    <Routes>
      <Route element={<DocumentsPage />}>
        <Route index element={<DocumentsListPage />} />
        <Route path="starred" element={<DocumentsListPage starred />} />
        <Route path="pdf" element={<DocumentsListPage type="PDF" />} />
        <Route path="word" element={<DocumentsListPage type="WORD" />} />
        <Route path="excel" element={<DocumentsListPage type="EXCEL" />} />
      </Route>
    </Routes>
  </ConfirmProvider>,
  { route, path: '/documents/*' },
);

describe('Documents home', () => {
  it('has a bar across the top with New and Open, then Recent, Starred and the file types', async () => {
    page();
    const menu = screen.getByRole('group', { name: 'Documents menu' });
    expect(within(menu).getByRole('button', { name: /^New/ })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: 'Open' })).toBeInTheDocument();
    const nav = within(menu).getByRole('navigation', { name: 'Document lists' });
    expect(within(nav).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/documents', '/documents/starred', '/documents/pdf', '/documents/word', '/documents/excel']);
    await waitFor(() => expect(within(nav).getByRole('link', { name: /Starred/ })).toHaveTextContent('1'));
    expect(within(nav).getByRole('link', { name: /PDF/ })).toHaveTextContent('1');
    expect(within(nav).getByRole('link', { name: /Word/ })).toHaveTextContent('2');
    expect(within(nav).getByRole('link', { name: /Excel/ })).toHaveTextContent('1');
  });

  it('opens on the recent files, grouped by how long ago they changed, with quick-start cards above', async () => {
    page();
    expect(await screen.findByRole('heading', { name: 'Recent' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Start something new' })).toBeInTheDocument();
    for (const group of ['Today', 'Within 7 days', 'Within 30 days', 'Older']) expect(await screen.findByRole('columnheader', { name: group })).toBeInTheDocument();
    const row = screen.getByText('Scan').closest('tr')!;
    expect(within(row).getByText('PDF')).toBeInTheDocument();
    expect(within(row).getByText('4.0 KB')).toBeInTheDocument();
    expect(service.getAll).toHaveBeenCalledWith(expect.not.objectContaining({ type: expect.anything() }));
  });

  it('closes the quick-start cards for good', async () => {
    const first = page();
    await userEvent.click(await screen.findByRole('button', { name: 'Close these shortcuts' }));
    expect(screen.queryByRole('region', { name: 'Start something new' })).not.toBeInTheDocument();
    first.unmount();
    page();
    await screen.findByRole('heading', { name: 'Recent' });
    expect(screen.queryByRole('region', { name: 'Start something new' })).not.toBeInTheDocument();
  });

  it('filters by type with the All types menu', async () => {
    page();
    await screen.findByText('Scan');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by type' }), 'EXCEL');
    await waitFor(() => expect(service.getAll).toHaveBeenCalledWith(expect.objectContaining({ type: 'EXCEL', limit: 100 })));
    await waitFor(() => expect(screen.queryByText('Scan')).not.toBeInTheDocument());
    expect(screen.getByText('Packing sheet')).toBeInTheDocument();
  });

  it('has no File Information panel, and every file has Edit, Download and Delete beside it', async () => {
    page();
    await screen.findByText('Packing sheet');
    expect(screen.queryByRole('complementary', { name: 'File information' })).not.toBeInTheDocument();
    for (const action of ['Edit', 'Download', 'Delete']) expect(screen.getByRole('button', { name: `${action} Packing sheet` })).toBeInTheDocument();
  });

  it('stars and unstars a file', async () => {
    service.update.mockResolvedValue(doc({ starred: true }));
    page();
    await userEvent.click(await screen.findByRole('button', { name: 'Star Price list' }));
    await waitFor(() => expect(service.update).toHaveBeenCalledWith('d1', { starred: true }));
  });

  it('lists only the starred files on the Starred page', async () => {
    page('/documents/starred');
    expect(await screen.findByRole('heading', { name: 'Starred' })).toBeInTheDocument();
    expect(await screen.findByText('Scan')).toBeInTheDocument();
    expect(screen.queryByText('Price list')).not.toBeInTheDocument();
    expect(service.getAll).toHaveBeenCalledWith(expect.objectContaining({ starred: 'true', limit: 100 }));
    expect(screen.queryByRole('region', { name: 'Start something new' })).not.toBeInTheDocument();
  });

  it('shows only one kind from the file types, without the type filter', async () => {
    page();
    await userEvent.click(screen.getByRole('link', { name: /Word/ }));
    expect(await screen.findByRole('heading', { name: 'Word files' })).toBeInTheDocument();
    expect(await screen.findByText('Price list')).toBeInTheDocument();
    expect(screen.queryByText('Scan')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Filter by type' })).not.toBeInTheDocument();
    expect(service.getAll).toHaveBeenCalledWith(expect.objectContaining({ type: 'WORD', limit: 100 }));
  });

  it('lets you pick the kind from New, asks for a name, then creates the document', async () => {
    service.create.mockResolvedValue(doc({ id: 'new1', title: 'Contract' }));
    page();
    const menu = screen.getByRole('group', { name: 'Documents menu' });
    await userEvent.click(within(menu).getByRole('button', { name: /^New/ }));
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    expect(items.map((i) => i.textContent?.trim())).toEqual(['New PDF', 'New Word document', 'New spreadsheet']);
    await userEvent.click(items[1]!);
    const dialog = screen.getByRole('dialog', { name: 'New Word document' });
    expect(within(dialog).getByRole('button', { name: 'Create' })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Contract');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(service.create).toHaveBeenCalledWith({ title: 'Contract', type: 'WORD', content: '' }));
  });

  it('starts a new PDF from a quick-start card, with optional text', async () => {
    service.create.mockResolvedValue(doc({ id: 'new2', title: 'Notes', type: 'PDF' }));
    page();
    const cards = await screen.findByRole('region', { name: 'Start something new' });
    await userEvent.click(within(cards).getByRole('button', { name: /New PDF/ }));
    const dialog = screen.getByRole('dialog', { name: 'New PDF' });
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Notes');
    await userEvent.type(within(dialog).getByLabelText('Text (optional)'), 'Hello');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(service.create).toHaveBeenCalledWith({ title: 'Notes', type: 'PDF', content: 'Hello' }));
  });

  it('asks before deleting', async () => {
    service.delete.mockResolvedValue({ success: true, data: null, error: null, meta: null } as never);
    page();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Scan' }));
    expect(service.delete).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(service.delete).toHaveBeenCalledWith('d3'));
  });
});
