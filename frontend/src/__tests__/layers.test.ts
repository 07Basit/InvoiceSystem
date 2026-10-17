import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards the stacking order documented in src/lib/layers.md. A dropdown inside a layered parent can never
// rise above that parent, so the top bar (which holds the bell and account dropdowns) must be above
// everything it can overlap (pinned bars, floating buttons, tooltips), and popups/toasts above it.

const read = (file: string) => readFileSync(resolve(__dirname, '..', file), 'utf8');

/** The z-index of the first element in `file` whose class list contains `marker`. */
function z(file: string, marker: string): number {
  const src = read(file);
  const line = src.split('\n').find((l) => l.includes(marker));
  if (!line) throw new Error(`"${marker}" not found in ${file}`);
  const m = /(?<![\w:-])z-(?:\[(\d+)\]|(\d+))(?![\w-])/.exec(line); // z-40 or z-[9999], not sm:z-40
  if (!m) throw new Error(`no z-index on the "${marker}" line of ${file}`);
  return Number(m[1] ?? m[2]);
}

const layers = {
  detailHeader: z('features/invoices/pages/InvoiceDetailPage.tsx', 'sticky -top-4'),
  filterBar: z('components/ui/FilterBar.tsx', 'sticky -top-4'),
  scrollToTop: z('components/ui/ScrollToTop.tsx', 'fixed bottom-5'),
  tooltip: z('components/ui/Tooltip.tsx', 'pointer-events-none absolute'),
  topBar: z('components/layout/TopBar.tsx', '<header'),
  bellDropdown: z('features/notifications/components/NotificationBell.tsx', 'overflow-hidden rounded-xl'),
  chartPopup: z('features/dashboard/pages/DashboardPage.tsx', 'fixed inset-0'),
  menuBackdrop: z('components/layout/Sidebar.tsx', 'fixed inset-0'),
  menuDrawer: z('components/layout/Sidebar.tsx', 'fixed inset-y-0'),
  importerForm: z('features/clients/pages/ClientsPage.tsx', 'fixed inset-0'),
  invoiceForm: z('features/invoices/components/InvoiceForm.tsx', 'fixed inset-0'),
  confirm: z('components/ui/confirm.tsx', 'fixed inset-0'),
  toast: z('components/ui/toast.tsx', 'pointer-events-none fixed'),
};

describe('stacking order', () => {
  it('puts the top bar above pinned bars, the back-to-top button and tooltips, so its dropdowns are never covered', () => {
    expect(layers.topBar).toBeGreaterThan(layers.filterBar);
    expect(layers.topBar).toBeGreaterThan(layers.detailHeader);
    expect(layers.topBar).toBeGreaterThan(layers.scrollToTop);
    expect(layers.topBar).toBeGreaterThan(layers.tooltip);
  });

  it('keeps pinned bars above ordinary page content', () => {
    expect(layers.filterBar).toBeGreaterThanOrEqual(20);
    expect(layers.detailHeader).toBeGreaterThanOrEqual(20);
  });

  it('puts popups above the top bar, and the mobile menu above both', () => {
    expect(layers.chartPopup).toBeGreaterThan(layers.topBar);
    expect(layers.menuBackdrop).toBeGreaterThan(layers.topBar);
    expect(layers.menuDrawer).toBeGreaterThan(layers.menuBackdrop);
  });

  it('shows form popups over the page, confirm dialogs over forms, and toasts over everything', () => {
    expect(layers.importerForm).toBeGreaterThan(layers.menuDrawer);
    expect(layers.invoiceForm).toBeGreaterThan(layers.menuDrawer);
    expect(layers.confirm).toBeGreaterThan(layers.importerForm);
    expect(layers.confirm).toBeGreaterThan(layers.invoiceForm);
    expect(layers.toast).toBeGreaterThan(layers.confirm);
  });

  it('keeps the bell dropdown inside the top bar layer (it cannot rise above its parent)', () => {
    expect(layers.bellDropdown).toBeLessThanOrEqual(50);
  });
});
