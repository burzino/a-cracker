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
┌────────────────────────────┐  aggiunge / archivia  ┌──────────────────────────────┐
│ PWA (GitHub Pages)         │ ────────────────────▶ │ Firestore                    │
│ Svelte 5, Firebase SDK     │ ◀──── onSnapshot ──── │  products/{asin}             │
│  - lista in tempo reale    │                       │  devices/{token}             │
│  - Attiva notifiche        │ ── registra token ──▶ │                              │
└─────────────▲──────────────┘                       └──────────────▲───────────────┘
              │ legge data/prices.json                              │ legge products,
              │                                                     │ legge devices
┌─────────────┴──────────────┐  deploy su push   ┌──────────────────┴───────────────┐
│ GitHub Pages (pages.yml)   │ ◀──────────────── │ GitHub Actions (update-prices)   │
│ build Vite → dist/         │                   │ cron ogni ora: 17 * * * *        │
└────────────────────────────┘                   │ scripts/update-prices.mjs        │
                                                 │  - legge products (firebase-admin)│
                                                 │  - scarica pagine Amazon attive  │
                                                 │  - aggiorna data/prices.json     │
                                                 │  - notifica i cambi via FCM      │
                                                 └──────────────┬───────────────────┘
                                                                │ commit solo se cambiato
                                                  repo: data/prices.json (versionato)
```

Scelte:

- **Stack della PWA: Svelte 5 + Vite 8** (`@sveltejs/vite-plugin-svelte` per i componenti `.svelte`). Svelte compila i componenti in JavaScript vanilla, quindi l'output è un bundle statico (`dist/`) senza runtime server. Il build produce `index.html`, `assets/` (JS e CSS con nome hash) e copia `public/` (service worker, manifest, icone) e `data/` (prezzi). `base: './'` rende tutti i percorsi relativi, così il sito funziona su `https://<utente>.github.io/<repo>/`. Il codice di presentazione puro (`src/lib/stats.mjs`) resta senza DOM e testabile con `node:test`. Nessun `{@html}`: il template Svelte escapa i dati del job.
- **Lista prodotti in Firestore**, collezione `products`, un documento per ASIN (id = ASIN). La PWA legge con `onSnapshot` e scrive con `setDoc` / `updateDoc` (Firebase JS SDK). L'aggiunta usa una transazione che rilegge il documento, così due dispositivi non si sovrascrivono. Non c'è un token GitHub nel browser né un backend proprio.
- **Prezzi come file nel repo** (`data/prices.json`), storico versionato da git. Il job lo scrive e lo committa solo se è cambiato. La PWA lo legge dal sito pubblicato.
- **Notifiche push con Firebase Cloud Messaging (Web Push)**. I dispositivi si registrano in Firestore, collezione `devices` (documento id = token FCM, campi `createdAt`, `lastSeenAt`). Il client non può leggere né cancellare la collezione (`firestore.rules`). Il job orario legge la collezione con `firebase-admin` (service account nel secret `FIREBASE_SERVICE_ACCOUNT`) e invia messaggi data-only `{ title, body }`; il service worker `public/firebase-messaging-sw.js` costruisce la notifica anche a pagina chiusa. Il service worker di Firebase ha uno scope proprio (`./firebase-push/`) e non sostituisce la cache offline `sw.js`. I token respinti da FCM (`registration-token-not-registered`, `invalid-registration-token`) vengono cancellati.
- **Configurazione Firebase pubblica**: le chiavi `VITE_FIREBASE_*` non sono segreti (sono pubbliche per design, vanno come repository variables). Il secret è solo la service account usata dal job.
- **Provider di prezzo intercambiabile**: `scripts/lib/` contiene il parser puro; in futuro si può sostituire lo scraping con la PA-API senza toccare la PWA.
- **Service worker** con strategia network-first per tutte le GET (shell e dati): la freschezza viene dalla rete, la cache serve solo offline, così l'app si apre con l'ultimo prezzo noto. Vengono messe in cache solo le risposte `ok`.
- **Gate di accesso solo di facciata**: schermata con password statica (`src/components/Gate.svelte`, logica in `src/lib/gate.js`). Il confronto avviene con SHA-256 (`crypto.subtle`) e nel sorgente c'è solo l'hash, mai la password in chiaro. Lo sblocco è in `sessionStorage` (`a-cracker-ok`) con fallback se lo storage manca. I dati si caricano solo dopo lo sblocco. Non è una protezione vera: il sito è statico e i dati sono pubblici, chiunque può leggere il bundle o aggirare la schermata. Serve solo a tenere la pagina lontana da sguardi occasionali.

## 4. Modello dei dati

`products/{asin}` in Firestore (lista gestita dalla PWA):
```json
{ "asin": "B0XXXXXXXX", "targetPrice": 49.9, "addedAt": "2026-10-22T10:00:00.000Z", "archivedAt": null }
```

- `asin`: uguale all'id del documento; 10 caratteri alfanumerici maiuscoli.
- `targetPrice`: facoltativo, numero positivo.
- `addedAt`: ISO, presente nei documenti creati dalla PWA. `validateProducts` lo accetta assente per compatibilità, ma se presente deve essere ISO.
- `archivedAt`: assente o `null` = attivo. Una data ISO = archiviato: il job non scarica il prodotto, ma `buildPricesFile` conserva la sua voce in `prices.json`, così il ripristino riprende lo storico. "Rimuovi" nella PWA archivia, non cancella.
- `name` non è scritto dalla PWA: il nome viene preso dalla pagina Amazon e salvato in `prices.json`.
- Il job valida i documenti con `productsFromDocuments` (`scripts/lib/products.mjs`): un documento con `asin` diverso dall'id o con campi non validi fa fallire il job, così l'errore è visibile in Actions.

`devices/{token}` in Firestore: `{ createdAt, lastSeenAt }` (timestamp del server). Scrivibile dal client solo con questi due campi; non leggibile.

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

Cambi di prezzo per le notifiche: `detectPriceChanges(previous, next, products)` (`scripts/lib/notifications.mjs`) confronta `current` prima e dopo il run, solo per i prodotti attivi. Non notifica il primo rilevamento, né un prezzo nullo su uno dei due lati, né un prezzo invariato. I cambi sono calcolati in memoria e non vengono mai scritti in `prices.json`. La notifica parte dopo la scrittura del file; un errore di invio viene solo registrato e non fa fallire il job.

Job senza secret: se `FIREBASE_SERVICE_ACCOUNT` manca o non è JSON valido, il job scrive un avviso ed esce con successo senza toccare `prices.json` (senza Firestore non ci sono prodotti da leggere). Un errore di rete o di Firestore invece fa fallire il job, così si vede in Actions.

## 5. Funzionalità

**Fase 1 (MVP)**
- Elenco prodotti con prezzo attuale, minimo e massimo storici.
- Badge "sotto target" quando `current <= targetPrice`.
- Grafico storico semplice (SVG, nessuna libreria).
- Dettaglio prodotto con tabella dello storico e link ad Amazon.
- Installabile (manifest + icona maskable), funziona offline con l'ultimo snapshot in cache del service worker.
- Job GitHub Actions per aggiornare i prezzi ogni ora (`17 * * * *`); deploy automatico su Pages.

**Fase 2 (implementata in questo ramo)**
- Aggiunta prodotti dalla PWA incollando il link Amazon (`src/lib/amazon-link.js`), con prezzo target facoltativo. Scrittura su Firestore (`src/lib/products-store.js`), con transazione per evitare sovrascritture.
- Lista in tempo reale (`onSnapshot`): le modifiche da altri dispositivi compaiono senza ricaricare.
- Rimozione = archiviazione (`archivedAt`), con sezione Archivio e Ripristina (`src/lib/product-list.js`).
- Notifiche push di cambio prezzo via Firebase Cloud Messaging (vedi sezione 3).

**Fuori scope per ora**
- Autenticazione e multi-utente.
- Notifiche per soglie di prezzo diverse dal cambio (es. "sotto target" anche senza variazione).

## 6. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Amazon restituisce CAPTCHA al job | Il job registra l'errore nel campo `error` e mantiene l'ultimo prezzo noto; non fallisce l'intero run. |
| Cambio di markup | Più strategie di estrazione (offscreen, JSON embedded, priceblock). Fixture di test per ciascuna. |
| Ban IP di GitHub Actions | Frequenza oraria (scelta dell'utente: più richieste di prima, quindi più esposizione), User-Agent realistico, nessun parallelismo, pausa di 4 s tra richieste. Se necessario ridurre la frequenza o passare a PA-API. |
| Violazione ToS | Documentato qui. Decisione dell'utente: uso personale a basso volume, oppure migrazione alla PA-API. |
| Lista prodotti scrivibile da chiunque abbia la config web | Tradeoff esplicito, scelto dall'utente: il gate è solo di facciata. Le regole in `firestore.rules` limitano campi, forma di `asin` e date, ma non l'autore. Mitigazione possibile: App Check, oppure Firebase Auth con regole per utente. |
| Collezione `devices` | Non leggibile dai client; il job cancella i token che FCM dichiara non validi. |
| Notifica inviata ma commit di `prices.json` fallito | La notifica parte prima del commit. Se il push del commit fallisce, al run successivo il cambio riappare e viene notificato di nuovo: rischio di duplicato, non di perdita. |
| Regole Firestore non pubblicate | La PWA mostra "Firestore ha negato l'accesso" finché le regole non sono pubblicate. Le regole non vengono pubblicate dal workflow. |
| Service account nel secret | Solo in `FIREBASE_SERVICE_ACCOUNT`, mai nel repo; `.gitignore` esclude `*service-account*.json`. Va ruotata se cambia chi ha accesso ad Actions. |
| Notifiche su iOS | Web Push su iPhone/iPad solo dall'app installata in Home (iOS 16.4+). La PWA mostra le istruzioni. |

## 7. Decisioni aperte (da confermare dall'utente)

1. **Marketplace**: il default del progetto è `amazon.it`. Confermare.
2. **Fonte dei dati**: scraping (gratis, fragile, contro i ToS) oppure PA-API (richiede account Partner)? Il progetto è predisposto per entrambe, implementato lo scraping.
3. **Frequenza di aggiornamento**: decisa dall'utente, cron orario (`17 * * * *`).
4. **Nome del repository e URL Pages**: da definire al momento del deploy.
5. **Protezione della lista in Firestore**: accettato il tradeoff di scrittura aperta; da rivedere se la PWA diventa pubblica.

## 8. Piano di sviluppo

1. Setup ambiente agentico (`.claude/agents/`: analyst, developer, reviewer).
2. Logica pura: parser prezzi e aggiornamento storico, con test su fixture.
3. Script di aggiornamento prezzi.
4. PWA: HTML, CSS, app.js, service worker, manifest, icona.
5. Workflow GitHub Actions (aggiornamento + deploy Pages).
6. Review indipendente dell'agente reviewer, correzione dei problemi trovati.
7. README e CLAUDE.md.
