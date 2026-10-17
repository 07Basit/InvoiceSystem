ALTER TABLE [dbo].[invoices] ADD [declaration] NVARCHAR(2000);

-- Existing invoices keep the wording they have always shown.
EXEC('UPDATE invoices SET declaration = ''We declare that this Invoice shows the actual price of the goods described and that all particulars are true and correct.'' WHERE declaration IS NULL');
