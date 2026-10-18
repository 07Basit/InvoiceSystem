CREATE TABLE [dbo].[product_lists] (
    [id] NVARCHAR(1000) NOT NULL,
    [importerId] NVARCHAR(1000) NOT NULL,
    [currency] NVARCHAR(3) NOT NULL,
    [locationName] NVARCHAR(200),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [product_lists_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [product_lists_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE NONCLUSTERED INDEX [product_lists_importerId_idx] ON [dbo].[product_lists]([importerId]);

ALTER TABLE [dbo].[product_lists] ADD CONSTRAINT [product_lists_importerId_fkey] FOREIGN KEY ([importerId]) REFERENCES [dbo].[importers]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
