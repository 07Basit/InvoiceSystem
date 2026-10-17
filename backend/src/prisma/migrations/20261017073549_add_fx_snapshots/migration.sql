BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[fx_snapshots] (
    [id] NVARCHAR(1000) NOT NULL,
    [date] DATE NOT NULL,
    [rates] NVARCHAR(max) NOT NULL,
    CONSTRAINT [fx_snapshots_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [fx_snapshots_date_key] UNIQUE NONCLUSTERED ([date])
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
