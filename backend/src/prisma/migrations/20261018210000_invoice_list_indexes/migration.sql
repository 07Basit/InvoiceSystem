-- The invoice list reads "live, not a hidden page, newest first"; the dashboard and summary read "live originals".
CREATE NONCLUSTERED INDEX [invoices_deletedAt_isCompanion_createdAt_idx] ON [dbo].[invoices]([deletedAt], [isCompanion], [createdAt]);
CREATE NONCLUSTERED INDEX [invoices_deletedAt_actualOfId_counterpartOfId_idx] ON [dbo].[invoices]([deletedAt], [actualOfId], [counterpartOfId]);
