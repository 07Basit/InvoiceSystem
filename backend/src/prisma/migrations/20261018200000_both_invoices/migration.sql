-- A BOTH invoice (party and custom on one invoice) keeps its custom page as a hidden companion invoice.
ALTER TABLE [dbo].[invoices] ADD [isCompanion] BIT NOT NULL CONSTRAINT [invoices_isCompanion_df] DEFAULT 0;
