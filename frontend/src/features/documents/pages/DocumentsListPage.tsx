import DocumentsList from '../components/DocumentsList';
import type { DocumentType } from 'shared';

interface DocumentsListPageProps {
  type?: DocumentType;
  starred?: boolean;
}

/** One list of the Documents area: the recent files, the starred ones, or just PDF, Word or Excel. */
export default function DocumentsListPage({ type, starred }: DocumentsListPageProps) {
  // a new key per list gives each its own search box and selection
  return <DocumentsList key={starred ? 'starred' : type ?? 'recent'} {...(type ? { type } : {})} {...(starred ? { starred } : {})} />;
}
