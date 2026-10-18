-- Products can belong to an importer, optionally narrowed to a currency and a landing location.
ALTER TABLE [dbo].[products] DROP CONSTRAINT [products_name_key];

ALTER TABLE [dbo].[products] ADD [importerId] NVARCHAR(1000), [currency] NVARCHAR(3), [locationName] NVARCHAR(200);

CREATE NONCLUSTERED INDEX [products_importerId_idx] ON [dbo].[products]([importerId]);

ALTER TABLE [dbo].[products] ADD CONSTRAINT [products_importerId_fkey] FOREIGN KEY ([importerId]) REFERENCES [dbo].[importers]([id]) ON DELETE CASCADE ON UPDATE CASCADE;
