-- Party / custom invoices: a kind, a link to the counterpart, and the number printed inside the documents of a copy.
ALTER TABLE [dbo].[invoices] ADD [invoiceKind] NVARCHAR(10) NOT NULL CONSTRAINT [invoices_invoiceKind_df] DEFAULT 'PARTY',
    [counterpartOfId] NVARCHAR(1000),
    [printedNumber] NVARCHAR(1000);

CREATE NONCLUSTERED INDEX [invoices_counterpartOfId_idx] ON [dbo].[invoices]([counterpartOfId]);

ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_counterpartOfId_fkey] FOREIGN KEY ([counterpartOfId]) REFERENCES [dbo].[invoices]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
