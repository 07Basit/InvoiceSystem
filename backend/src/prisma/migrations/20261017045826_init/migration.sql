BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[importers] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [address] NVARCHAR(max) NOT NULL,
    [contact] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000),
    [buyerName] NVARCHAR(1000) NOT NULL,
    [currency] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [importers_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [importers_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[landing_locations] (
    [id] NVARCHAR(1000) NOT NULL,
    [importerId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [portOfDischarge] NVARCHAR(1000) NOT NULL,
    [finalDestination] NVARCHAR(1000) NOT NULL,
    [countryOfDestination] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [landing_locations_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [landing_locations_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[loading_locations] (
    [id] NVARCHAR(1000) NOT NULL,
    [importerId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [portOfLoading] NVARCHAR(1000) NOT NULL,
    [countryOfOrigin] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [loading_locations_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [loading_locations_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[exporter_profiles] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [address] NVARCHAR(1000) NOT NULL,
    [contact] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000),
    [isLocked] BIT NOT NULL CONSTRAINT [exporter_profiles_isLocked_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [exporter_profiles_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [exporter_profiles_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[invoices] (
    [id] NVARCHAR(1000) NOT NULL,
    [invoiceNumber] NVARCHAR(1000) NOT NULL,
    [invoiceDate] DATETIME2 NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [invoices_status_df] DEFAULT 'DRAFT',
    [importerId] NVARCHAR(1000) NOT NULL,
    [landingLocationId] NVARCHAR(1000),
    [loadingLocationId] NVARCHAR(1000),
    [exportersRef] NVARCHAR(1000),
    [otherReferences] NVARCHAR(1000),
    [awbNumber] NVARCHAR(1000),
    [preCarriageBy] NVARCHAR(1000),
    [placeOfReceiptByPreCarrier] NVARCHAR(1000),
    [vesselFlightNo] NVARCHAR(1000),
    [portOfLoading] NVARCHAR(1000),
    [portOfDischarge] NVARCHAR(1000),
    [finalDestination] NVARCHAR(1000),
    [buyerName] NVARCHAR(1000),
    [countryOfOrigin] NVARCHAR(1000),
    [countryOfDestination] NVARCHAR(1000),
    [descriptionOfGoods] NVARCHAR(max),
    [hsCode] NVARCHAR(1000),
    [termsOfDelivery] NVARCHAR(1000),
    [termsOfPayment] NVARCHAR(1000),
    [currency] NVARCHAR(1000) NOT NULL,
    [exporterName] NVARCHAR(1000),
    [exporterAddress] NVARCHAR(1000),
    [exporterContact] NVARCHAR(1000),
    [exporterEmail] NVARCHAR(1000),
    [totalBoxes] INT NOT NULL CONSTRAINT [invoices_totalBoxes_df] DEFAULT 0,
    [totalNetWeight] DECIMAL(12,2) NOT NULL CONSTRAINT [invoices_totalNetWeight_df] DEFAULT 0,
    [totalGrossWeight] DECIMAL(12,2),
    [subTotal] DECIMAL(12,2) NOT NULL CONSTRAINT [invoices_subTotal_df] DEFAULT 0,
    [roundOff] DECIMAL(12,2) NOT NULL CONSTRAINT [invoices_roundOff_df] DEFAULT 0,
    [total] DECIMAL(12,2) NOT NULL CONSTRAINT [invoices_total_df] DEFAULT 0,
    [amountInWords] NVARCHAR(max),
    [notes] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [invoices_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [invoices_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [invoices_invoiceNumber_key] UNIQUE NONCLUSTERED ([invoiceNumber])
);

-- CreateTable
CREATE TABLE [dbo].[line_items] (
    [id] NVARCHAR(1000) NOT NULL,
    [invoiceId] NVARCHAR(1000) NOT NULL,
    [marksAndNos] NVARCHAR(1000),
    [containerNo] NVARCHAR(1000),
    [descriptionOfGoods] NVARCHAR(max) NOT NULL,
    [netWeightPerPackage] DECIMAL(12,2) NOT NULL,
    [numberOfBoxes] INT NOT NULL,
    [totalNetWeight] DECIMAL(12,2) NOT NULL,
    [ratePerKg] DECIMAL(12,2) NOT NULL,
    [totalPerBox] DECIMAL(12,2) NOT NULL,
    [amount] DECIMAL(12,2) NOT NULL,
    CONSTRAINT [line_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[documents] (
    [id] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL CONSTRAINT [documents_type_df] DEFAULT 'WORD',
    [content] NVARCHAR(max),
    [fileUrl] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [documents_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [documents_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [importers_name_idx] ON [dbo].[importers]([name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [importers_deletedAt_idx] ON [dbo].[importers]([deletedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [landing_locations_importerId_idx] ON [dbo].[landing_locations]([importerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [loading_locations_importerId_idx] ON [dbo].[loading_locations]([importerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [invoices_importerId_idx] ON [dbo].[invoices]([importerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [invoices_landingLocationId_idx] ON [dbo].[invoices]([landingLocationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [invoices_loadingLocationId_idx] ON [dbo].[invoices]([loadingLocationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [invoices_status_idx] ON [dbo].[invoices]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [invoices_status_deletedAt_idx] ON [dbo].[invoices]([status], [deletedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [invoices_invoiceNumber_idx] ON [dbo].[invoices]([invoiceNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [invoices_invoiceDate_idx] ON [dbo].[invoices]([invoiceDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [invoices_deletedAt_idx] ON [dbo].[invoices]([deletedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [line_items_invoiceId_idx] ON [dbo].[line_items]([invoiceId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documents_type_idx] ON [dbo].[documents]([type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documents_deletedAt_idx] ON [dbo].[documents]([deletedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [documents_type_deletedAt_idx] ON [dbo].[documents]([type], [deletedAt]);

-- AddForeignKey
ALTER TABLE [dbo].[landing_locations] ADD CONSTRAINT [landing_locations_importerId_fkey] FOREIGN KEY ([importerId]) REFERENCES [dbo].[importers]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[loading_locations] ADD CONSTRAINT [loading_locations_importerId_fkey] FOREIGN KEY ([importerId]) REFERENCES [dbo].[importers]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_importerId_fkey] FOREIGN KEY ([importerId]) REFERENCES [dbo].[importers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_landingLocationId_fkey] FOREIGN KEY ([landingLocationId]) REFERENCES [dbo].[landing_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_loadingLocationId_fkey] FOREIGN KEY ([loadingLocationId]) REFERENCES [dbo].[loading_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[line_items] ADD CONSTRAINT [line_items_invoiceId_fkey] FOREIGN KEY ([invoiceId]) REFERENCES [dbo].[invoices]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
