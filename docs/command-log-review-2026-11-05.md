# Command log and forecast evidence review — 5 November 2026

SEAF: bundled game effect1401 is named Heavy SEAF Presence (Enemies), but its description explicitly describes conventional allied troops. The suffix is a data-group label, not proof of an enemy. It is now identified by effect id, rendered as blue allied support with a helmet icon, and separated from enemy divisions in the planet card.

Division naming: effect type40 contains a division hash (value type16), not an enemy-objective unit id. Names now come from the matching galactic effect id. Added Caustic effects1430/1431 from helldivers-2/json, commit72f33989dd68452dd71003f19f18eaca12a9a756 (effects/planetEffects.json). An unrecognized id remains explicitly unidentified. No automatic Noxious/Caustic substitution.

Noxious is confirmed by Arrowhead's3November announcement:
https://blog.playstation.com/2026/11/03/helldivers-2-new-poisonous-terminid-types-more-bug-caves-spawn-across-the-galaxy-today/
The current raw effect1434 has division hash903954334 and name hash4130906463. Its readable name was not independently resolved from the sources checked, so this patch does not assign one.

Extraction: official WarSeason/GalacticWarEffects currently returns type21 effects1312/1315/1363 with valueTypes[3,1] and values[0,20/40/30]. The game text describes extraction-time changes in seconds (#V_TWO):
https://github.com/shalzuth/HelldiversData/blob/c13b2b94907959292473ff6935ad113326848e88/data/translations/English.json
These additive durations are shown with sign and seconds; removal is described separately. Unsupported parameter shapes remain undecoded rather than treated as percentages or absolute arrival times. Stacked modifiers can change the final wait.

The log now uses independent vertical category stacks, so a long Mission effects list does not push Dispatches down in the other column. Races keep original objective ids and option numbers; the recommended objective leads, urgent defenses and larger shortfalls follow, completed objectives form a separate final group. Full Plan is unchanged.

Forecast basis is an independent, conservative data-coverage diagnostic, not a calibrated accuracy percentage. It never modifies engine predictions. Its rule thresholds and limitations are disclosed in the expandable panel. Closed/open state and keyboard focus survive ordinary re-renders. Tests cover stale/missing/duplicated/future readings, recent changes, campaign boundaries, custom assumptions, option orders and resolved results.

The former cap of three active non-war effects has been removed from intelFor: filtering and category stacks now handle the full relevant set. The evidence badge ages to Limited after15minutes without a successful update, without rebuilding the page or losing keyboard focus.
