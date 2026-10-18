import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExporterPage from '../pages/ExporterPage';
import { signService, type SignProfile } from '@/features/invoices/services/signService';
import { bankService, type BankProfile } from '@/features/invoices/services/bankService';
import { declarationService, type DeclarationProfile } from '@/features/invoices/services/declarationService';
import { exporterService, type ExporterProfile } from '@/features/invoices/services/exporterService';
import { renderRoutes, setAuth } from '@/__tests__/utils';

vi.mock('@/features/invoices/services/exporterService', () => ({
  exporterService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), setDefault: vi.fn(), setActive: vi.fn(), remove: vi.fn() },
}));
vi.mock('@/features/invoices/services/bankService', () => ({
  bankService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), setDefault: vi.fn(), setActive: vi.fn(), remove: vi.fn() },
}));
vi.mock('@/features/invoices/services/signService', () => ({
  signService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), setDefault: vi.fn(), setActive: vi.fn(), remove: vi.fn() },
}));
vi.mock('@/features/invoices/services/declarationService', () => ({
  declarationService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), setDefault: vi.fn(), setActive: vi.fn(), remove: vi.fn() },
}));
const exporters = vi.mocked(exporterService);
const banks = vi.mocked(bankService);
const signs = vi.mocked(signService);
const declarations = vi.mocked(declarationService);

const sign = (over: Partial<SignProfile> = {}): SignProfile => ({
  id: 's1', name: 'Proprietor sign', image: 'data:image/png;base64,AAAA', isDefault: true, isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});
const signList = (...data: SignProfile[]) => ({ success: true as const, data, error: null, meta: null });

const bank = (over: Partial<BankProfile> = {}): BankProfile => ({
  id: 'b1', bankName: 'HDFC BANK', accountNumber: '5036834342323', ifscCode: 'HDFC45300321', swiftCode: null, isDefault: true, isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});
const bankList = (...data: BankProfile[]) => ({ success: true as const, data, error: null, meta: null });

const profile = (over: Partial<ExporterProfile> = {}): ExporterProfile => ({
  id: 'e1', name: 'Green Harvest', address: '1 Dock Rd', contact: '+91 90000 10000', email: null, isDefault: true, isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});
const listOf = (...data: ExporterProfile[]) => ({ success: true as const, data, error: null, meta: null });

const declaration = (over: Partial<DeclarationProfile> = {}): DeclarationProfile => ({
  id: 'd1', name: 'Standard declaration', text: 'We declare that this invoice shows the actual price.\nAll particulars are true.', isDefault: true, isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});
const declarationList = (...data: DeclarationProfile[]) => ({ success: true as const, data, error: null, meta: null });

const renderExporter = () => renderRoutes(<ExporterPage />, { route: '/exporter', path: '/exporter' });

beforeEach(() => {
  vi.clearAllMocks();
  exporters.list.mockResolvedValue(listOf());
  banks.list.mockResolvedValue(bankList());
  signs.list.mockResolvedValue(signList());
  declarations.list.mockResolvedValue(declarationList());
  setAuth('authenticated');
});

describe('Exporter page', () => {
  it('holds exporter profiles, bank accounts, seal & sign and declarations', async () => {
    renderExporter();
    for (const name of ['Exporter', 'Exporter profiles', 'Bank accounts', 'Seal & Sign', 'Declarations']) {
      expect(await screen.findByRole('heading', { name })).toBeInTheDocument();
    }
  });
});

describe('Exporter page — declarations', () => {
  it('lists declarations with the default badge and a not-needed one', async () => {
    declarations.list.mockResolvedValue(declarationList(declaration(), declaration({ id: 'd2', name: 'Short form', text: 'True and correct.', isDefault: false, isActive: false })));
    renderExporter();
    expect(await screen.findByText('Standard declaration')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('Not needed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make Short form the default' })).not.toBeInTheDocument();
  });

  it('invites you to add the first declaration', async () => {
    renderExporter();
    expect(await screen.findByText('No declarations yet')).toBeInTheDocument();
  });

  it('needs a name and the text before saving', async () => {
    const user = userEvent.setup();
    renderExporter();
    await user.click(await screen.findByRole('button', { name: /Add declaration/ }));
    await user.click(screen.getByRole('button', { name: /Save declaration/ }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Declaration text is required')).toBeInTheDocument();
    expect(declarations.create).not.toHaveBeenCalled();
  });

  it('creates a declaration with line breaks kept', async () => {
    declarations.create.mockResolvedValue({ success: true, data: declaration(), error: null, meta: null });
    const user = userEvent.setup();
    renderExporter();
    await user.click(await screen.findByRole('button', { name: /Add declaration/ }));
    await user.type(screen.getByLabelText('Name'), 'Short form');
    await user.type(screen.getByLabelText('Declaration text'), 'Line one{Enter}Line two');
    await user.click(screen.getByRole('button', { name: /Save declaration/ }));
    await waitFor(() => expect(declarations.create).toHaveBeenCalledWith({ name: 'Short form', text: 'Line one\nLine two' }));
  });

  it('changes the default and marks one as not needed', async () => {
    declarations.list.mockResolvedValue(declarationList(declaration(), declaration({ id: 'd2', name: 'Short form', isDefault: false })));
    declarations.setDefault.mockResolvedValue({ success: true, data: declaration({ id: 'd2' }), error: null, meta: null });
    declarations.setActive.mockResolvedValue({ success: true, data: declaration({ id: 'd2', isActive: false }), error: null, meta: null });
    const user = userEvent.setup();
    renderExporter();
    await user.click(await screen.findByRole('button', { name: 'Make Short form the default' }));
    await waitFor(() => expect(declarations.setDefault).toHaveBeenCalledWith('d2'));
    await user.click(screen.getByRole('button', { name: 'Mark Short form as not needed' }));
    await waitFor(() => expect(declarations.setActive).toHaveBeenCalledWith('d2', false));
  });
});

describe('Exporter page — exporter profiles', () => {
  it('lists profiles and marks the default', async () => {
    exporters.list.mockResolvedValue(listOf(profile(), profile({ id: 'e2', name: 'Blue Exports', isDefault: false })));
    renderExporter();
    expect(await screen.findByText('Blue Exports')).toBeInTheDocument();
    expect(screen.getByText('Green Harvest')).toBeInTheDocument();
    expect(screen.getAllByText('Default')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Make Blue Exports the default' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make Green Harvest the default' })).not.toBeInTheDocument();
  });

  it('invites you to add the first profile when there are none', async () => {
    renderExporter();
    expect(await screen.findByText('No exporter profiles yet')).toBeInTheDocument();
  });

  it('validates before calling the server', async () => {
    renderExporter();
    await userEvent.click(await screen.findByRole('button', { name: /add profile/i }));
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }));
    expect(await screen.findByText('Exporter name is required')).toBeInTheDocument();
    expect(exporters.create).not.toHaveBeenCalled();
  });

  it('creates a profile', async () => {
    exporters.create.mockResolvedValue({ success: true, data: profile(), error: null, meta: null });
    renderExporter();
    await userEvent.click(await screen.findByRole('button', { name: /add profile/i }));
    await userEvent.type(screen.getByLabelText('Exporter name'), 'Green Harvest');
    await userEvent.type(screen.getByLabelText('Contact'), '+91 90000 10000');
    await userEvent.type(screen.getByLabelText('Address'), '1 Dock Rd');
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }));
    await waitFor(() => expect(exporters.create).toHaveBeenCalledWith({ name: 'Green Harvest', address: '1 Dock Rd', contact: '+91 90000 10000' }));
  });

  it('marks a profile as not needed, and brings it back', async () => {
    exporters.list.mockResolvedValue(listOf(profile(), profile({ id: 'e2', name: 'Blue Exports', isDefault: false, isActive: false })));
    exporters.setActive.mockResolvedValue({ success: true, data: profile(), error: null, meta: null });
    renderExporter();
    expect(await screen.findByText('Not needed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make Blue Exports the default' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Make Blue Exports active again' }));
    await waitFor(() => expect(exporters.setActive).toHaveBeenCalledWith('e2', true));
    await userEvent.click(screen.getByRole('button', { name: 'Mark Green Harvest as not needed' }));
    await waitFor(() => expect(exporters.setActive).toHaveBeenCalledWith('e1', false));
  });

  it('changes the default', async () => {
    exporters.list.mockResolvedValue(listOf(profile(), profile({ id: 'e2', name: 'Blue Exports', isDefault: false })));
    exporters.setDefault.mockResolvedValue({ success: true, data: profile({ id: 'e2', isDefault: true }), error: null, meta: null });
    renderExporter();
    await userEvent.click(await screen.findByRole('button', { name: 'Make Blue Exports the default' }));
    await waitFor(() => expect(exporters.setDefault).toHaveBeenCalledWith('e2'));
  });
});

describe('Exporter page — bank accounts', () => {
  it('lists accounts with the default, not-needed badge and no star on an inactive one', async () => {
    banks.list.mockResolvedValue(bankList(bank(), bank({ id: 'b2', bankName: 'ICICI BANK', accountNumber: '111122223333', isDefault: false, isActive: false })));
    renderExporter();
    expect(await screen.findByText('ICICI BANK')).toBeInTheDocument();
    expect(screen.getByText('HDFC BANK')).toBeInTheDocument();
    expect(screen.getByText('Not needed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Make ICICI BANK ending 3333 the default/ })).not.toBeInTheDocument();
  });

  it('validates, then creates an account', async () => {
    banks.create.mockResolvedValue({ success: true, data: bank(), error: null, meta: null });
    renderExporter();
    await userEvent.click(await screen.findByRole('button', { name: /add account/i }));
    await userEvent.click(screen.getByRole('button', { name: /save account/i }));
    expect(await screen.findByText('Bank name is required')).toBeInTheDocument();
    expect(banks.create).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Bank name'), 'HDFC BANK');
    await userEvent.type(screen.getByLabelText('Account number'), '5036834342323');
    await userEvent.click(screen.getByRole('button', { name: /save account/i }));
    await waitFor(() => expect(banks.create).toHaveBeenCalledWith({ bankName: 'HDFC BANK', accountNumber: '5036834342323' }));
  });

  it('marks an account as not needed', async () => {
    banks.list.mockResolvedValue(bankList(bank()));
    banks.setActive.mockResolvedValue({ success: true, data: bank(), error: null, meta: null });
    renderExporter();
    await userEvent.click(await screen.findByRole('button', { name: /Mark HDFC BANK ending 2323 as not needed/ }));
    await waitFor(() => expect(banks.setActive).toHaveBeenCalledWith('b1', false));
  });
});

describe('Exporter page — seal & sign', () => {
  it('lists signs with previews, the default badge and a not-needed one', async () => {
    signs.list.mockResolvedValue(signList(sign(), sign({ id: 's2', name: 'Company seal', isDefault: false, isActive: false })));
    renderExporter();
    expect(await screen.findByText('Company seal')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Proprietor sign preview' })).toHaveAttribute('src', 'data:image/png;base64,AAAA');
    expect(screen.getAllByText('Default').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Make Company seal active again' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make Company seal the default seal and sign' })).not.toBeInTheDocument();
  });

  it('needs a name and an image before saving', async () => {
    renderExporter();
    await userEvent.click(await screen.findByRole('button', { name: /add seal & sign/i }));
    await userEvent.click(screen.getByRole('button', { name: /save seal & sign/i }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Choose an image.')).toBeInTheDocument();
    expect(signs.create).not.toHaveBeenCalled();
  });

  it('marks a sign as not needed', async () => {
    signs.list.mockResolvedValue(signList(sign()));
    signs.setActive.mockResolvedValue({ success: true, data: sign(), error: null, meta: null });
    renderExporter();
    await userEvent.click(await screen.findByRole('button', { name: 'Mark Proprietor sign as not needed' }));
    await waitFor(() => expect(signs.setActive).toHaveBeenCalledWith('s1', false));
  });
});
