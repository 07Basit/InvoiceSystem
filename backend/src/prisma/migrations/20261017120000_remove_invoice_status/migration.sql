BEGIN TRY

BEGIN TRAN;

-- DropIndex
DROP INDEX [invoices_status_idx] ON [dbo].[invoices];

-- DropIndex
DROP INDEX [invoices_status_deletedAt_idx] ON [dbo].[invoices];

-- DropDefaultConstraint
ALTER TABLE [dbo].[invoices] DROP CONSTRAINT [invoices_status_df];

-- AlterTable
ALTER TABLE [dbo].[invoices] DROP COLUMN [status];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
