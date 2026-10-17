BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[invoices] ADD [importerAddress] NVARCHAR(1000),
[importerContact] NVARCHAR(1000),
[importerEmail] NVARCHAR(1000),
[importerName] NVARCHAR(1000);

-- Existing invoices keep the importer details they show today (the best record of what they were).
-- EXEC so the new columns exist when this statement is compiled.
EXEC('UPDATE i SET i.importerName = m.name, i.importerAddress = m.address, i.importerContact = m.contact, i.importerEmail = m.email
      FROM [dbo].[invoices] i JOIN [dbo].[importers] m ON m.id = i.importerId
      WHERE i.importerName IS NULL');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
