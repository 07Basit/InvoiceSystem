-- CreateTable
CREATE TABLE "importers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "buyerName" TEXT,
    "currency" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "importers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_locations" (
    "id" TEXT NOT NULL,
    "importerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "portOfDischarge" TEXT NOT NULL,
    "finalDestination" TEXT NOT NULL,
    "countryOfDestination" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loading_locations" (
    "id" TEXT NOT NULL,
    "importerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "portOfLoading" TEXT NOT NULL,
    "countryOfOrigin" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loading_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exporter_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "email" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exporter_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_settings" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_rates" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ECB',

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "importerId" TEXT NOT NULL,
    "landingLocationId" TEXT,
    "loadingLocationId" TEXT,
    "exportersRef" TEXT,
    "otherReferences" TEXT,
    "awbNumber" TEXT,
    "buyersOrder" TEXT,
    "preCarriageBy" TEXT,
    "placeOfReceiptByPreCarrier" TEXT,
    "vesselFlightNo" TEXT,
    "portOfLoading" TEXT,
    "portOfDischarge" TEXT,
    "finalDestination" TEXT,
    "buyerName" TEXT,
    "importerName" TEXT,
    "importerAddress" TEXT,
    "importerContact" TEXT,
    "importerEmail" TEXT,
    "countryOfOrigin" TEXT,
    "countryOfDestination" TEXT,
    "descriptionOfGoods" TEXT,
    "hsCode" TEXT,
    "termsOfDelivery" TEXT,
    "termsOfPayment" TEXT,
    "currency" TEXT NOT NULL,
    "exporterName" TEXT,
    "exporterAddress" TEXT,
    "exporterContact" TEXT,
    "exporterEmail" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfscCode" TEXT,
    "bankSwiftCode" TEXT,
    "signName" TEXT,
    "signImage" TEXT,
    "actualOfId" TEXT,
    "invoiceKind" VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
    "counterpartOfId" TEXT,
    "printedNumber" TEXT,
    "isCompanion" BOOLEAN NOT NULL DEFAULT false,
    "totalBoxes" INTEGER NOT NULL DEFAULT 0,
    "totalNetWeight" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalGrossWeight" DECIMAL(12,2),
    "subTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "roundOff" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountInWords" TEXT,
    "notes" TEXT,
    "declaration" VARCHAR(2000),
    "manualRate" DECIMAL(18,8),
    "manualRateBase" TEXT,
    "manualRateSetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "marksAndNos" TEXT,
    "containerNo" TEXT,
    "descriptionOfGoods" TEXT NOT NULL,
    "netWeightPerPackage" DECIMAL(12,2) NOT NULL,
    "numberOfBoxes" INTEGER NOT NULL,
    "totalNetWeight" DECIMAL(12,2) NOT NULL,
    "ratePerKg" DECIMAL(12,2) NOT NULL,
    "totalPerBox" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'WORD',
    "content" TEXT,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "details" TEXT,
    "link" TEXT,
    "linkLabel" TEXT,
    "actorName" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_profiles" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifscCode" TEXT,
    "swiftCode" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "importerId" TEXT,
    "currency" VARCHAR(3),
    "locationName" VARCHAR(200),
    "nettWeightPerPackage" DECIMAL(10,3),
    "ratePerKg" DECIMAL(12,4),
    "hsCode" VARCHAR(30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_lists" (
    "id" TEXT NOT NULL,
    "importerId" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "locationName" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sign_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sign_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "declaration_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "declaration_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "importers_name_idx" ON "importers"("name");

-- CreateIndex
CREATE INDEX "importers_deletedAt_idx" ON "importers"("deletedAt");

-- CreateIndex
CREATE INDEX "landing_locations_importerId_idx" ON "landing_locations"("importerId");

-- CreateIndex
CREATE INDEX "loading_locations_importerId_idx" ON "loading_locations"("importerId");

-- CreateIndex
CREATE UNIQUE INDEX "fx_rates_fromCurrency_toCurrency_date_key" ON "fx_rates"("fromCurrency", "toCurrency", "date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_importerId_idx" ON "invoices"("importerId");

-- CreateIndex
CREATE INDEX "invoices_landingLocationId_idx" ON "invoices"("landingLocationId");

-- CreateIndex
CREATE INDEX "invoices_loadingLocationId_idx" ON "invoices"("loadingLocationId");

-- CreateIndex
CREATE INDEX "invoices_invoiceNumber_idx" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_actualOfId_idx" ON "invoices"("actualOfId");

-- CreateIndex
CREATE INDEX "invoices_counterpartOfId_idx" ON "invoices"("counterpartOfId");

-- CreateIndex
CREATE INDEX "invoices_invoiceDate_idx" ON "invoices"("invoiceDate");

-- CreateIndex
CREATE INDEX "invoices_deletedAt_idx" ON "invoices"("deletedAt");

-- CreateIndex
CREATE INDEX "invoices_deletedAt_isCompanion_createdAt_idx" ON "invoices"("deletedAt", "isCompanion", "createdAt");

-- CreateIndex
CREATE INDEX "invoices_deletedAt_actualOfId_counterpartOfId_idx" ON "invoices"("deletedAt", "actualOfId", "counterpartOfId");

-- CreateIndex
CREATE INDEX "line_items_invoiceId_idx" ON "line_items"("invoiceId");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "documents_deletedAt_idx" ON "documents"("deletedAt");

-- CreateIndex
CREATE INDEX "documents_type_deletedAt_idx" ON "documents"("type", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "products_importerId_idx" ON "products"("importerId");

-- CreateIndex
CREATE INDEX "product_lists_importerId_idx" ON "product_lists"("importerId");

-- CreateIndex
CREATE INDEX "drafts_userId_kind_updatedAt_idx" ON "drafts"("userId", "kind", "updatedAt");

-- AddForeignKey
ALTER TABLE "landing_locations" ADD CONSTRAINT "landing_locations_importerId_fkey" FOREIGN KEY ("importerId") REFERENCES "importers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loading_locations" ADD CONSTRAINT "loading_locations_importerId_fkey" FOREIGN KEY ("importerId") REFERENCES "importers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_importerId_fkey" FOREIGN KEY ("importerId") REFERENCES "importers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_landingLocationId_fkey" FOREIGN KEY ("landingLocationId") REFERENCES "landing_locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_loadingLocationId_fkey" FOREIGN KEY ("loadingLocationId") REFERENCES "loading_locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_actualOfId_fkey" FOREIGN KEY ("actualOfId") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_counterpartOfId_fkey" FOREIGN KEY ("counterpartOfId") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_importerId_fkey" FOREIGN KEY ("importerId") REFERENCES "importers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_lists" ADD CONSTRAINT "product_lists_importerId_fkey" FOREIGN KEY ("importerId") REFERENCES "importers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
