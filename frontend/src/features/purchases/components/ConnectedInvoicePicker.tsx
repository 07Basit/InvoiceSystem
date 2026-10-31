import { useMemo } from 'react';
import SearchCombobox, { type ComboOption } from '@/components/ui/SearchCombobox';
import { useInvoices } from '@/features/invoices/hooks/useInvoices';
import { dateLabel } from '../utils/format';

interface ConnectedInvoicePickerProps {
  /** The chosen actual invoice's id, or '' for none */
  value: string;
  /** What to show for the chosen invoice (it may not be among the latest invoices listed) */
  label: string;
  onChange: (id: string, label: string) => void;
}

/** Choose the actual invoice a purchase was made for. Only actual invoices are offered (the 100 most recent). */
const ConnectedInvoicePicker: React.FC<ConnectedInvoicePickerProps> = ({ value, label, onChange }) => {
  const { data, isLoading } = useInvoices({ type: 'actual', limit: 100 });
  const invoices = useMemo(() => data?.data ?? [], [data]);

  const options = useMemo<ComboOption[]>(() => [
    { value: '', label: 'No connected invoice' },
    ...invoices.map((inv) => ({
      value: inv.id,
      label: inv.invoiceNumber,
      description: [inv.importerName, inv.currency, dateLabel(inv.invoiceDate)].filter(Boolean).join(' · '),
    })),
  ], [invoices]);

  return (
    <SearchCombobox
      value={value}
      display={value ? label : ''}
      onChange={(id) => {
        const inv = invoices.find((i) => i.id === id);
        onChange(id, inv ? [inv.invoiceNumber, inv.importerName].filter(Boolean).join(' · ') : '');
      }}
      options={options}
      loading={isLoading}
      ariaLabel="Connected invoice"
      placeholder="No connected invoice"
      searchPlaceholder="Search your actual invoices…"
      labelClassName="w-48 truncate"
      className="input w-full"
    />
  );
};

export default ConnectedInvoicePicker;
