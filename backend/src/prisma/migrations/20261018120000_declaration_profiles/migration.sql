CREATE TABLE [dbo].[declaration_profiles] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [text] NVARCHAR(max) NOT NULL,
    [isDefault] BIT NOT NULL CONSTRAINT [declaration_profiles_isDefault_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [declaration_profiles_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [declaration_profiles_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [declaration_profiles_pkey] PRIMARY KEY CLUSTERED ([id])
);
