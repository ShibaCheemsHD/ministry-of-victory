# Audit completo — riepilogo

Data: 1 novembre 2026 · Ministry of Victory · Sei dimensioni, in sola lettura (l'unica correzione già fatta è SEC-01, su richiesta).

| Audit | Report | Critica | Alta | Media | Bassa | Confidenza |
|-------|--------|---------|------|-------|-------|------------|
| Architettura | [arch-audit](../architecture/arch-audit-2026-11-01.md) | 0 | 2 | 3 | 3 | alta |
| Sicurezza | [security-audit](../security/security-audit-2026-11-01.md) | 0 | 1 ✅ | 2 | 3 | alta |
| DevOps | [devops-audit](../devops/devops-audit-2026-11-01.md) | 0 | 2 | 3 | 3 | alta |
| Codice | [code-review](../code-review/code-review-2026-11-01.md) | 0 | 0 | 3 | 4 | alta |
| Prodotto | [po-audit](../product/po-audit-2026-11-01.md) | 0 | 0 | 4 | 3 | media |
| Esperienza utente | [ux-audit](../ux/ux-audit-2026-11-01.md) | 0 | 1 | 3 | 3 | alta |
| **Totale** | | **0** | **6** (1 già corretta) | **18** | **19** | |

✅ SEC-01 (testi esterni eseguiti come codice) corretto in `0fbff4a`, con test di regressione.

## Temi che tornano in più audit

1. **Lo stato del registratore è fragile** (ARCH-01, ARCH-02, OPS-04, CR-03): può essere sovrascritto da uno vuoto, non ha copie, cresce senza limite. È il dato più prezioso del progetto (misure, difese, previsioni registrate) e il meno protetto.
2. **Rilasci e controlli manuali** (ARCH-03, OPS-01, OPS-03, OPS-06, ARCH-04, CR-05): la pubblicazione non aspetta i test, il registratore va riavviato a mano, non c'è un linter. Funziona perché i test girano in locale prima di ogni push, non perché il processo lo garantisce.
3. **Il telefono è il caso principale ma il meno curato** (UX-01, UX-02, UX-04, UX-05, CR-01): contenuto tagliato nel Piano, azioni lontane, archivio lunghissimo, storico locale oltre la quota.
4. **Si lavora senza dati sull'uso** (PO-01, PO-02, PO-07, UX-03): nessuna metrica e nessun canale di ritorno.

## Azioni, in ordine

### Alta
1. **ARCH-01** — Il registratore non deve mai partire da uno storico vuoto se il branch `data` esiste: riprovare il fetch e fermarsi senza pushare se fallisce. *(piccolo)*
2. **ARCH-02 / OPS-04** — Copia giornaliera di `history.json` (branch `data-backup` o artifact con retention 30 giorni). *(piccolo)*
3. **OPS-01** — Pubblicare la pagina con `deploy-pages` dopo i test, non dal branch. *(medio)*
4. **OPS-02** — Node 20 → 22 in tutti i workflow. *(piccolo)*
5. **UX-01** — Piano tagliato sul telefono; e controllo della larghezza dopo ogni scheda nei test. *(piccolo)*

### Media
6. **ARCH-03 / OPS-03** — Il registratore esce da solo quando `main` cambia.
7. **CR-02** — `timeout 540` sullo snapshot.
8. **CR-01** — Storico locale più piccolo (ultime 6 ore, campioni propri).
9. **UX-02** — Sul telefono le schede subito dopo la previsione.
10. **SEC-02** — CSP con gli hash degli script, generata in build.
11. **SEC-03** — Input del probe come variabile d'ambiente.
12. **ARCH-04 / CR-05** — ESLint (`no-undef`, `no-unused-vars`) in CI; rimuovere il codice morto.
13. **CR-03** — Potatura di `hist.calls` e `hist.hs` oltre 90 giorni.
14. **UX-03** — "Falls in time" invece di "On track" per i singoli pianeti di un ordine a più pianeti.
15. **UX-04** — Archivio a anni richiudibili.
16. **PO-01** — Contatore senza cookie (GoatCounter / Plausible) con 4-5 eventi.
17. **PO-02** — Link "Something wrong? Tell us" nel footer.
18. **PO-03** — Link all'affidabilità accanto alla previsione.
19. **PO-04** — Feed RSS dal registratore, poi webhook Discord.
20. **ARCH-05** — Dati del registratore anche da GitHub Pages, raw come riserva.
21. **OPS-05** — Piano B se GitHub ferma le Actions.

### Bassa
22. ARCH-06, ARCH-07, ARCH-08, SEC-04, SEC-05, SEC-06, OPS-06, OPS-07, OPS-08, CR-04, CR-06, CR-07, PO-05, PO-06, PO-07, UX-05, UX-06, UX-07 — vedi i report.

## Nota sul metodo

full-audit si appoggia a un manifest (`.github/audits/manifest.yml`) e a sei skill di audit separate che non erano presenti in questa sessione. Le sei dimensioni sono state eseguite seguendo la struttura dell'orchestratore (ordine, un report per dimensione, prove come `percorso:riga`, sola lettura, pausa tra un audit e l'altro), con verifiche dirette: riproduzione dell'XSS, ESLint sul codice assemblato, misure nel browser a 390 e 1366 px, storico dei run delle Actions.
