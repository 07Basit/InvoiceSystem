-- A plain invoice is NORMAL; PARTY and CUSTOM are only for invoices that are (or have) a party / custom partner.
DECLARE @df NVARCHAR(200);
SELECT @df = dc.name FROM sys.default_constraints dc
  JOIN sys.columns c ON c.default_object_id = dc.object_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.invoices') AND c.name = 'invoiceKind';
IF @df IS NOT NULL EXEC('ALTER TABLE [dbo].[invoices] DROP CONSTRAINT [' + @df + ']');
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_invoiceKind_df] DEFAULT 'NORMAL' FOR [invoiceKind];

-- invoices created before this (as the old default PARTY) with no partner become normal invoices
UPDATE [dbo].[invoices] SET [invoiceKind] = 'NORMAL'
WHERE [invoiceKind] = 'PARTY'
  AND [counterpartOfId] IS NULL
  AND [id] NOT IN (SELECT [counterpartOfId] FROM [dbo].[invoices] WHERE [counterpartOfId] IS NOT NULL);
