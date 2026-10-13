-- Removes the Alignment preset, whose card now sits on Identity. A preset the user retitled
-- or gave other blocks becomes a page of their own under the slug plus a random suffix,
-- keeping its blocks; hiding the stock page changes nothing worth keeping.
UPDATE `character_pages`
SET `slug` = `slug` || '-' || lower(hex(randomblob(4))), `preset` = 0
WHERE `preset` = 1 AND `slug` = 'alignment'
	AND (`title` <> 'Alignment' OR json(`blocks`) <> json('[{"kind":"section","section":"alignment"}]'));
--> statement-breakpoint
DELETE FROM `character_pages` WHERE `preset` = 1 AND `slug` = 'alignment';
