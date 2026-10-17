import { FileEdit } from 'lucide-react';

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Word documents and PDF files</p>
      </div>

      <div className="card-enterprise flex flex-col items-center justify-center text-center px-6 py-16 sm:py-24">
        <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mb-4">
          <FileEdit className="h-5 w-5 text-secondary-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Coming soon</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Document management is on its way. Check back later.
        </p>
      </div>
    </div>
  );
}
