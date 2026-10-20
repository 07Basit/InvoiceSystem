-- The bank profiles migration seeded one example account as the default. A new database must start with no bank account,
-- so the user adds their own. It is removed only while no invoice exists (so no data is lost), and only that exact row.
EXEC('DELETE FROM [dbo].[bank_profiles]
WHERE [bankName] = ''HDFC BANK'' AND [accountNumber] = ''5036834342323''
AND NOT EXISTS (SELECT 1 FROM [dbo].[invoices])');
