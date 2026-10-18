-- An actual invoice points back to the invoice it was made from.
ALTER TABLE [dbo].[invoices] ADD [actualOfId] NVARCHAR(1000);

CREATE NONCLUSTERED INDEX [invoices_actualOfId_idx] ON [dbo].[invoices]([actualOfId]);

ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_actualOfId_fkey] FOREIGN KEY ([actualOfId]) REFERENCES [dbo].[invoices]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
