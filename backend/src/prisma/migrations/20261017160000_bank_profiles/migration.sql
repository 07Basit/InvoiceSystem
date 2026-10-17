-- Bank accounts become saved profiles (default / not-needed flags) and each invoice keeps its own copy.
CREATE TABLE [dbo].[bank_profiles] (
    [id] NVARCHAR(1000) NOT NULL,
    [bankName] NVARCHAR(1000) NOT NULL,
    [accountNumber] NVARCHAR(1000) NOT NULL,
    [ifscCode] NVARCHAR(1000),
    [swiftCode] NVARCHAR(1000),
    [isDefault] BIT NOT NULL CONSTRAINT [bank_profiles_isDefault_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [bank_profiles_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [bank_profiles_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [bank_profiles_pkey] PRIMARY KEY CLUSTERED ([id])
);

ALTER TABLE [dbo].[invoices] ADD [bankName] NVARCHAR(1000), [bankAccountNumber] NVARCHAR(1000), [bankIfscCode] NVARCHAR(1000), [bankSwiftCode] NVARCHAR(1000);

-- The account the invoice form used to hard-code becomes the first (default) profile, so nothing is lost.
EXEC('INSERT INTO [dbo].[bank_profiles] ([id], [bankName], [accountNumber], [ifscCode], [swiftCode], [isDefault], [updatedAt])
VALUES (LOWER(CONVERT(VARCHAR(36), NEWID())), ''HDFC BANK'', ''5036834342323'', ''HDFC45300321'', ''HDFCINDFBXXX'', 1, SYSUTCDATETIME())');

-- Existing invoices take that account once; later profile edits never change them.
EXEC('UPDATE i SET i.bankName = p.bankName, i.bankAccountNumber = p.accountNumber, i.bankIfscCode = p.ifscCode, i.bankSwiftCode = p.swiftCode
FROM invoices i CROSS JOIN (SELECT TOP 1 * FROM bank_profiles WHERE isDefault = 1) p
WHERE i.bankName IS NULL AND i.bankAccountNumber IS NULL');
