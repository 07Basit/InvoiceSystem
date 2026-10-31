-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "contact" VARCHAR(200),
    "phone" VARCHAR(50),
    "email" VARCHAR(200),
    "address" VARCHAR(500),
    "gstin" VARCHAR(20),
    "importTemplate" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceNumber" VARCHAR(100) NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "purchaseDate" DATE,
    "dueDate" DATE,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "subTotal" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "freight" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherCharges" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "notes" VARCHAR(1000),
    "sourceFileName" VARCHAR(260),
    "sourceHash" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_lines" (
    "id" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "productName" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "quantity" DECIMAL(12,3),
    "netWeight" DECIMAL(12,3),
    "unit" VARCHAR(20),
    "rate" DECIMAL(14,4) NOT NULL,
    "rateBasis" VARCHAR(10) NOT NULL DEFAULT 'KG',
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "purchase_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "suppliers_deletedAt_idx" ON "suppliers"("deletedAt");

-- CreateIndex
CREATE INDEX "purchase_invoices_supplierId_invoiceDate_idx" ON "purchase_invoices"("supplierId", "invoiceDate");

-- CreateIndex
CREATE INDEX "purchase_invoices_invoiceDate_idx" ON "purchase_invoices"("invoiceDate");

-- CreateIndex
CREATE INDEX "purchase_invoices_purchaseDate_idx" ON "purchase_invoices"("purchaseDate");

-- CreateIndex
CREATE INDEX "purchase_invoices_sourceHash_idx" ON "purchase_invoices"("sourceHash");

-- CreateIndex
CREATE INDEX "purchase_invoices_deletedAt_idx" ON "purchase_invoices"("deletedAt");

-- CreateIndex
CREATE INDEX "purchase_lines_purchaseInvoiceId_idx" ON "purchase_lines"("purchaseInvoiceId");

-- CreateIndex
CREATE INDEX "purchase_lines_productName_idx" ON "purchase_lines"("productName");

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
