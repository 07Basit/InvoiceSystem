import { useDocuments, useDeleteDocument } from '../hooks/useDocuments';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Plus, Trash2, FileText, FileType } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function DocumentsPage() {
  const { data, isLoading, isError } = useDocuments();
  const deleteMutation = useDeleteDocument();
  const documents = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Word documents and PDF files</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90">
          <Plus className="h-4 w-4" /> New Document
        </button>
      </div>

      {isLoading && <div className="flex justify-center py-16"><LoadingSpinner /></div>}
      {isError && <div className="text-center py-16 text-destructive">Failed to load documents.</div>}

      {!isLoading && documents.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">No documents yet.</div>
      )}

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Updated</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(documents as Array<{ id: string; title: string; type: 'WORD' | 'PDF'; updatedAt: string }>).map((doc) => (
              <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {doc.type === 'WORD' ? (
                      <FileText className="h-4 w-4 text-blue-500" />
                    ) : (
                      <FileType className="h-4 w-4 text-red-500" />
                    )}
                    {doc.title}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    doc.type === 'WORD' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {doc.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(doc.updatedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => confirm(`Delete "${doc.title}"?`) && deleteMutation.mutate(doc.id)}
                      className="p-1.5 hover:bg-destructive/10 rounded-md"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
