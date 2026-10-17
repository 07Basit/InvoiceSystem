import type { Importer } from '../services/clientService';

export type StatusFilter = 'all' | 'active' | 'inactive';

/** Everything a person might type to find an importer: names, contacts, currency, ports and countries. */
function searchText(importer: Importer): string {
  return [
    importer.name,
    importer.buyerName,
    importer.contact,
    importer.email,
    importer.address,
    importer.currency,
    ...importer.landingLocations.flatMap((l) => [l.name, l.portOfDischarge, l.finalDestination, l.countryOfDestination]),
    ...importer.loadingLocations.flatMap((l) => [l.name, l.portOfLoading, l.countryOfOrigin]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function filterImporters(importers: Importer[], query: string, status: StatusFilter): Importer[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return importers.filter((importer) => {
    const isActive = importer.isActive !== false;
    if (status === 'active' && !isActive) return false;
    if (status === 'inactive' && isActive) return false;
    if (terms.length === 0) return true;
    const text = searchText(importer);
    return terms.every((term) => text.includes(term)); // every word must match somewhere
  });
}
