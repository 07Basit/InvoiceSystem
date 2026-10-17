BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[currency_settings] (
    [id] NVARCHAR(1000) NOT NULL,
    [baseCurrency] NVARCHAR(1000) NOT NULL CONSTRAINT [currency_settings_baseCurrency_df] DEFAULT 'USD',
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [currency_settings_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[currency_rates] (
    [id] NVARCHAR(1000) NOT NULL,
    [currency] NVARCHAR(1000) NOT NULL,
    [rateToBase] DECIMAL(18,6) NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [currency_rates_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [currency_rates_currency_key] UNIQUE NONCLUSTERED ([currency])
);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
