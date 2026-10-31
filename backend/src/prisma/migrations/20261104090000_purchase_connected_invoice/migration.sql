-- AlterTable
ALTER TABLE "purchase_invoices" ADD COLUMN "invoiceId" TEXT;

-- CreateIndex
CREATE INDEX "purchase_invoices_invoiceId_idx" ON "purchase_invoices"("invoiceId");

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
