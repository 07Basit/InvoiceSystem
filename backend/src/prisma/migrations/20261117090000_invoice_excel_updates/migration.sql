-- CreateTable
CREATE TABLE "invoice_excel_updates" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "fileName" VARCHAR(260),
    "before" JSONB NOT NULL,
    "afterVersion" VARCHAR(40) NOT NULL,
    "added" INTEGER NOT NULL DEFAULT 0,
    "removed" INTEGER NOT NULL DEFAULT 0,
    "changed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "invoice_excel_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_excel_updates_invoiceId_createdAt_idx" ON "invoice_excel_updates"("invoiceId", "createdAt");

-- AddForeignKey
ALTER TABLE "invoice_excel_updates" ADD CONSTRAINT "invoice_excel_updates_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
