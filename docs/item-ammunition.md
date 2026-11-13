# Range and ammunition

`range` (`80/320`, in feet) sits on base and named items alike, thrown melee weapons
included. `ammoType` names the ammunition by uid, lowercase: `arrow|phb`, or `energy cell`
with no source, which matches any source. `reload` is on base firearms. An attack carries
all three, and lists the loose one-piece stacks of its ammunition in the carried
inventory, by index with their quantity. A pack such as `Arrows (20)` (PHB) is neither
listed nor counted. A sourced `ammoType` matches that exact uid, so an XPHB bow does not
list PHB arrows. Magic ammunition and homebrew ammunition list nothing, as neither names a
uid an `ammoType` can match.

Firing a piece adds it to `spentAmmunition` in the play state, keyed by the uid and the
item it came from, so Recover one piece survives a reload and can add the item back where
no stack remains. Recovering takes it off again.
