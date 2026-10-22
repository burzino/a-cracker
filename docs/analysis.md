# Analisi – Amazon Price Tracker (PWA)

## 1. Obiettivo

Una Progressive Web App installabile che mostra l'andamento del prezzo di una lista di prodotti Amazon, con indicazione del prezzo minimo/massimo e di un eventuale prezzo target. Deve girare come sito statico su **GitHub Pages**, senza server dedicato.

## 2. Vincoli chiave

| Vincolo | Conseguenza |
|---|---|
| GitHub Pages serve solo file statici | La PWA non può interrogare Amazon direttamente. |
| Il browser blocca le richieste cross-origin verso amazon.it (CORS) | Il recupero dei prezzi deve avvenire lato server. |
| Amazon non offre un'API di prezzo libera | Serve la **Product Advertising API** (richiede account Partner Amazon con vendite qualificate) oppure lo scraping delle pagine prodotto. |
| Lo scraping viola le Condizioni d'uso di Amazon | Rischio di blocco IP / CAPTCHA e rischio contrattuale. Uso solo personale e a basso volume. |
| Le pagine Amazon cambiano markup spesso | Il parser deve essere isolato e testato su fixture, con fallback multipli. |
| GitHub Actions gira su IP datacenter | Amazon risponde spesso con "Robot Check": il job deve tollerare i fallimenti per singolo prodotto. |

## 3. Architettura scelta

```
┌──────────────────────────┐   cron ogni 6h    ┌────────────────────────────┐
│ GitHub Actions           │ ───────────────▶  │ scripts/update-prices.mjs  │
│ update-prices.yml        │                   │  - legge data/products.json│
└──────────────────────────┘                   │  - scarica pagina Amazon   │
                                               │  - estrae prezzo           │
                                               │  - aggiorna data/prices.json│
                                               └──────────────┬─────────────┘
                                                              │ commit se cambiato
┌──────────────────────────┐  deploy su push   ┌──────────────▼─────────────┐
│ GitHub Pages             │ ◀──────────────── │ repo (src/ + public/ + data/)│
│ pages.yml                │                   └────────────────────────────┘
│  PWA: build Vite → dist/ │
│  legge data/*.json       │
└──────────────────────────┘
```

Scelte:

- **Stack della PWA: Svelte 5 + Vite 8** (`@sveltejs/vite-plugin-svelte` per i componenti `.svelte`). Svelte compila i componenti in JavaScript vanilla, quindi l'output è un bundle statico (`dist/`) senza runtime server. Il build produce `index.html`, `assets/` (JS e CSS con nome hash) e copia `public/` (service worker, manifest, icone) e `data/` (prezzi). `base: './'` rende tutti i percorsi relativi, così il sito funziona su `https://<utente>.github.io/<repo>/`. Il codice di presentazione puro (`src/lib/stats.mjs`) resta senza DOM e testabile con `node:test`. Nessun `{@html}`: il template Svelte escapa i dati del job.
- **Dati come file nel repo** (`data/products.json`, `data/prices.json`). Nessun database, nessun backend, storico versionato da git.
- **Provider di prezzo intercambiabile**: `scripts/lib/` contiene il parser puro; in futuro si può sostituire lo scraping con la PA-API senza toccare la PWA.
- **Service worker** con strategia network-first per tutte le GET (shell e dati): la freschezza viene dalla rete, la cache serve solo offline, così l'app si apre con l'ultimo prezzo noto. Vengono messe in cache solo le risposte `ok`.
- **Gate di accesso solo di facciata**: schermata con password statica (`src/components/Gate.svelte`, logica in `src/lib/gate.js`). Il confronto avviene con SHA-256 (`crypto.subtle`) e nel sorgente c'è solo l'hash, mai la password in chiaro. Lo sblocco è in `sessionStorage` (`a-cracker-ok`) con fallback se lo storage manca. I dati si caricano solo dopo lo sblocco. Non è una protezione vera: il sito è statico e i dati sono pubblici, chiunque può leggere il bundle o aggirare la schermata. Serve solo a tenere la pagina lontana da sguardi occasionali.

## 4. Modello dei dati

`data/products.json` (lista gestita dall'utente):
```json
[
  { "asin": "B0XXXXXXXX", "name": "Cuffie XY", "targetPrice": 49.9 }
]
```

`data/prices.json` (generato dal job):
```json
{
  "updatedAt": "2026-10-22T10:00:00.000Z",
  "items": {
    "B0XXXXXXXX": {
      "name": "Cuffie XY",
      "currency": "EUR",
      "current": 54.99,
      "checkedAt": "2026-10-22T10:00:00.000Z",
      "error": null,
      "history": [ { "date": "2026-10-20T10:00:00.000Z", "price": 59.99 } ]
    }
  }
}
```

Regole di storico: si aggiunge un punto solo quando il prezzo cambia. Lo storico è limitato agli ultimi 365 giorni, ma l'ultimo punto è sempre conservato (altrimenti un prezzo fermo da più di un anno perderebbe min/max e sparkline).

Regole di scrittura: il job riscrive `data/prices.json` solo se cambiano `name`, `current`, `error` o `history` di almeno un prodotto (funzione `hasPriceChanges`). `updatedAt` e `checkedAt` non fanno scattare il commit. Conseguenza: `checkedAt` non indica l'ultima verifica, quindi la card non mostra più "Verificato il". La card mostra "Prezzo del <data>" con la data dell'ultimo punto dello storico; l'header mostra "Ultima variazione: <updatedAt>", dove `updatedAt` è la data dell'ultima scrittura dei dati.

## 5. Funzionalità

**Fase 1 (MVP, da sviluppare ora)**
- Elenco prodotti con prezzo attuale, minimo e massimo storici.
- Badge "sotto target" quando `current <= targetPrice`.
- Grafico storico semplice (SVG, nessuna libreria).
- Dettaglio prodotto con tabella dello storico e link ad Amazon.
- Installabile (manifest + icona maskable), funziona offline con l'ultimo snapshot in cache del service worker.
- Job GitHub Actions per aggiornare i prezzi ogni 6 ore; deploy automatico su Pages.

**Fuori scope per ora**
- Notifiche push (richiederebbero un servizio esterno o un backend).
- Aggiunta prodotti direttamente dalla PWA (richiederebbe scrivere nel repo o un backend; si può aggiungere con un'issue template o un'API esterna).
- Autenticazione e multi-utente.

## 6. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Amazon restituisce CAPTCHA al job | Il job registra l'errore nel campo `error` e mantiene l'ultimo prezzo noto; non fallisce l'intero run. |
| Cambio di markup | Più strategie di estrazione (offscreen, JSON embedded, priceblock). Fixture di test per ciascuna. |
| Ban IP di GitHub Actions | Frequenza bassa (6h), User-Agent realistico, nessun parallelismo, pausa tra richieste. Se necessario passare a PA-API. |
| Violazione ToS | Documentato qui. Decisione dell'utente: uso personale a basso volume, oppure migrazione alla PA-API. |

## 7. Decisioni aperte (da confermare dall'utente)

1. **Marketplace**: il default del progetto è `amazon.it`. Confermare.
2. **Fonte dei dati**: scraping (gratis, fragile, contro i ToS) oppure PA-API (richiede account Partner)? Il progetto è predisposto per entrambe, implementato lo scraping.
3. **Frequenza di aggiornamento**: default ogni 6 ore.
4. **Nome del repository e URL Pages**: da definire al momento del deploy.

## 8. Piano di sviluppo

1. Setup ambiente agentico (`.claude/agents/`: analyst, developer, reviewer).
2. Logica pura: parser prezzi e aggiornamento storico, con test su fixture.
3. Script di aggiornamento prezzi.
4. PWA: HTML, CSS, app.js, service worker, manifest, icona.
5. Workflow GitHub Actions (aggiornamento + deploy Pages).
6. Review indipendente dell'agente reviewer, correzione dei problemi trovati.
7. README e CLAUDE.md.
