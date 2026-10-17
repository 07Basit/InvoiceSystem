-- Invoices created before exporters were copied onto them take the default profile's details once,
-- so editing them shows an exporter instead of blank fields. Later profile edits never touch them.
EXEC('UPDATE i SET i.exporterName = p.name, i.exporterAddress = p.address, i.exporterContact = p.contact, i.exporterEmail = p.email
FROM invoices i CROSS JOIN (SELECT TOP 1 * FROM exporter_profiles ORDER BY isDefault DESC, updatedAt DESC) p
WHERE i.exporterName IS NULL AND i.exporterAddress IS NULL AND i.exporterContact IS NULL');
