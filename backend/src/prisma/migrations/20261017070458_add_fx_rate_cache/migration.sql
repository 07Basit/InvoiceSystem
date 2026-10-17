BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[fx_rates] (
    [id] NVARCHAR(1000) NOT NULL,
    [date] DATE NOT NULL,
    [fromCurrency] NVARCHAR(1000) NOT NULL,
    [toCurrency] NVARCHAR(1000) NOT NULL,
    [rate] DECIMAL(18,8) NOT NULL,
    CONSTRAINT [fx_rates_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [fx_rates_fromCurrency_toCurrency_date_key] UNIQUE NONCLUSTERED ([fromCurrency],[toCurrency],[date])
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
