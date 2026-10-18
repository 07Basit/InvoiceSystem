import ExporterProfilesSection from '../components/ExporterProfilesSection';
import BankProfilesSection from '../components/BankProfilesSection';
import SignProfilesSection from '../components/SignProfilesSection';
import DeclarationProfilesSection from '../components/DeclarationProfilesSection';

/** Everything printed on an invoice about the exporter, saved once and picked on each invoice. */
export default function ExporterPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exporter</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Exporter details, bank accounts, seal and sign, and declarations. Pick them on an invoice; each invoice keeps its own copy.
        </p>
      </div>

      <ExporterProfilesSection />
      <BankProfilesSection />
      <SignProfilesSection />
      <DeclarationProfilesSection />
    </div>
  );
}
