import { useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Receipt, Users, Clock, X } from 'lucide-react';
import { useRecycleBin, useRestoreRecord, usePermanentDelete } from '../hooks/useRecycleBin';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return `${mins}m ago`;
}

type ConfirmTarget = { type: 'invoice' | 'importer'; id: string; label: string } | null;

function ConfirmDialog({ target, onConfirm, onCancel }: { target: ConfirmTarget; onConfirm: () => void; onCancel: () => void }) {
  if (!target) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-border">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Permanently Delete?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              <strong>"{target.label}"</strong> will be permanently removed. This action{' '}
              <strong>cannot be undone</strong>.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-ghost px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
}

function RowActions({ onRestore, onDelete, disabled, className }: { onRestore: () => void; onDelete: () => void; disabled: boolean; className?: string }) {
  return (
    <div className={className ?? 'flex items-center justify-end gap-2'}>
      <button
        onClick={onRestore}
        disabled={disabled}
        className="flex items-center justify-center gap-1.5 text-xs py-1.5 px-3 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Restore
      </button>
      <button
        onClick={onDelete}
        className="flex items-center justify-center gap-1.5 text-xs py-1.5 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
        Delete
      </button>
    </div>
  );
}

function DeletedAgo({ at }: { at: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
      <Clock className="h-3 w-3" />
      {timeAgo(at)}
    </span>
  );
}

export default function RecycleBinPage() {
  const { data, isLoading } = useRecycleBin();
  const restore = useRestoreRecord();
  const purge = usePermanentDelete();
  const [confirm, setConfirm] = useState<ConfirmTarget>(null);
  const [activeTab, setActiveTab] = useState<'invoices' | 'importers'>('invoices');

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner variant="recycle" /></div>;

  const invoices = data?.invoices ?? [];
  const importers = data?.importers ?? [];
  const total = invoices.length + importers.length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="section-header !px-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Recycle Bin</h1>
            <p className="text-sm text-muted-foreground">
              {total === 0 ? 'No deleted records' : `${total} deleted record${total !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className="card-enterprise flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Trash2 className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Recycle bin is empty</h3>
          <p className="text-sm text-muted-foreground">Deleted invoices and importers will appear here.</p>
        </div>
      ) : (
        <>
          <div className="flex w-full gap-1 rounded-lg bg-muted p-1 sm:w-fit">
            {(['invoices', 'importers'] as const).map((tab) => {
              const count = tab === 'invoices' ? invoices.length : importers.length;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex flex-1 items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all sm:flex-none ${
                    activeTab === tab
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'invoices' ? <Receipt className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {count > 0 && (
                    <span className="ml-1 h-5 min-w-5 px-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold flex items-center justify-center">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {activeTab === 'invoices' && (
            <div className="card-enterprise overflow-hidden">
              {invoices.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No deleted invoices</div>
              ) : (
                <>
                <div className="divide-y md:hidden">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 break-words font-mono text-sm font-medium">{inv.invoiceNumber}</p>
                        <p className="shrink-0 text-sm font-medium">{inv.currency} {Number(inv.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-muted-foreground">
                        <p className="min-w-0 truncate text-sm">{inv.importerName ?? inv.importer.name}</p>
                        <DeletedAgo at={inv.deletedAt} />
                      </div>
                      <RowActions
                        className="grid grid-cols-2 gap-2 pt-1"
                        disabled={restore.isPending}
                        onRestore={() => restore.mutate({ type: 'invoice', id: inv.id })}
                        onDelete={() => setConfirm({ type: 'invoice', id: inv.id, label: inv.invoiceNumber })}
                      />
                    </div>
                  ))}
                </div>
                <table className="table-enterprise hidden md:table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Importer</th>
                      <th>Total</th>
                      <th>Deleted</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="font-mono text-sm font-medium">{inv.invoiceNumber}</td>
                        <td className="text-muted-foreground">{inv.importerName ?? inv.importer.name}</td>
                        <td className="font-medium">
                          {inv.currency} {Number(inv.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td><DeletedAgo at={inv.deletedAt} /></td>
                        <td>
                          <RowActions
                            disabled={restore.isPending}
                            onRestore={() => restore.mutate({ type: 'invoice', id: inv.id })}
                            onDelete={() => setConfirm({ type: 'invoice', id: inv.id, label: inv.invoiceNumber })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </>
              )}
            </div>
          )}

          {activeTab === 'importers' && (
            <div className="card-enterprise overflow-hidden">
              {importers.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No deleted importers</div>
              ) : (
                <>
                <div className="divide-y md:hidden">
                  {importers.map((imp) => (
                    <div key={imp.id} className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 break-words font-medium">{imp.name}</p>
                        <DeletedAgo at={imp.deletedAt} />
                      </div>
                      {imp.buyerName ? <p className="text-sm text-muted-foreground">{imp.buyerName}</p> : null}
                      {imp.contact ? <p className="text-sm text-muted-foreground">{imp.contact}</p> : null}
                      <RowActions
                        className="grid grid-cols-2 gap-2 pt-1"
                        disabled={restore.isPending}
                        onRestore={() => restore.mutate({ type: 'importer', id: imp.id })}
                        onDelete={() => setConfirm({ type: 'importer', id: imp.id, label: imp.name })}
                      />
                    </div>
                  ))}
                </div>
                <table className="table-enterprise hidden md:table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Buyer</th>
                      <th>Contact</th>
                      <th>Deleted</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importers.map((imp) => (
                      <tr key={imp.id}>
                        <td className="font-medium">{imp.name}</td>
                        <td className="text-muted-foreground">{imp.buyerName}</td>
                        <td className="text-muted-foreground text-sm">{imp.contact}</td>
                        <td><DeletedAgo at={imp.deletedAt} /></td>
                        <td>
                          <RowActions
                            disabled={restore.isPending}
                            onRestore={() => restore.mutate({ type: 'importer', id: imp.id })}
                            onDelete={() => setConfirm({ type: 'importer', id: imp.id, label: imp.name })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        target={confirm}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) {
            purge.mutate({ type: confirm.type, id: confirm.id });
            setConfirm(null);
          }
        }}
      />
    </div>
  );
}
