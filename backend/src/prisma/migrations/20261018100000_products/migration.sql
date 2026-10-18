CREATE TABLE [dbo].[products] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [nettWeightPerPackage] DECIMAL(10,3),
    [ratePerKg] DECIMAL(12,4),
    [hsCode] NVARCHAR(30),
    [isActive] BIT NOT NULL CONSTRAINT [products_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [products_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [products_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [products_name_key] UNIQUE NONCLUSTERED ([name])
);
