BEGIN TRY

BEGIN TRAN;

-- AlterTable: a default flag replaces the lock
ALTER TABLE [dbo].[exporter_profiles] ADD [isDefault] BIT NOT NULL CONSTRAINT [exporter_profiles_isDefault_df] DEFAULT 0;

-- The profile that was in use becomes the default
EXEC('UPDATE [dbo].[exporter_profiles] SET [isDefault] = 1 WHERE [id] = (SELECT TOP 1 [id] FROM [dbo].[exporter_profiles] ORDER BY [updatedAt] DESC)');

-- Drop isLocked together with its default constraint
DECLARE @df NVARCHAR(256);
SELECT @df = dc.name FROM sys.default_constraints dc
  JOIN sys.columns c ON c.default_object_id = dc.object_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.exporter_profiles') AND c.name = 'isLocked';
IF @df IS NOT NULL EXEC('ALTER TABLE [dbo].[exporter_profiles] DROP CONSTRAINT [' + @df + ']');
ALTER TABLE [dbo].[exporter_profiles] DROP COLUMN [isLocked];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
