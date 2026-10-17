CREATE TABLE [dbo].[sign_profiles] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [image] NVARCHAR(max) NOT NULL,
    [isDefault] BIT NOT NULL CONSTRAINT [sign_profiles_isDefault_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [sign_profiles_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [sign_profiles_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [sign_profiles_pkey] PRIMARY KEY CLUSTERED ([id])
);

ALTER TABLE [dbo].[invoices] ADD [signName] NVARCHAR(1000), [signImage] NVARCHAR(max);
