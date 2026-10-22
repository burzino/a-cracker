# Amazon Price Tracker

PWA statica che mostra l'andamento dei prezzi di una lista di prodotti Amazon. Dalla PWA puoi aggiungere un prodotto incollando il suo link Amazon, rimuoverlo (finisce nell'archivio) e ricevere una notifica push quando il prezzo cambia. La lista dei prodotti è in Firestore; i prezzi vengono controllati ogni ora da GitHub Actions e pubblicati su GitHub Pages. Vedi [docs/analysis.md](docs/analysis.md) per vincoli, architettura e rischi (in particolare: lo scraping di Amazon è contro le sue Condizioni d'uso).

## Setup locale

Requisito: Node.js 20.19 o superiore (Vite 8). Prima del primo uso installa le dipendenze:

```bash
npm install             # Svelte 5, Vite 8, firebase (client), firebase-admin (job)
npm test                # test unitari e test del build
npm run build           # build della PWA in dist/ (riesce anche senza variabili Firebase)
npm run update-prices   # aggiorna i prezzi (richiede FIREBASE_SERVICE_ACCOUNT e rete)
npm run serve           # build di dist/ e server su http://localhost:8080
npm run icons           # rigenera le icone PWA (solo se cambi il disegno)
```

Per provare la PWA con Firestore in locale copia `.env.example` in `.env.local` e compila i valori `VITE_FIREBASE_*` (vedi Configurazione). `.env*` è escluso da git. Senza questi valori la PWA mostra "Firebase non configurato".

## Aggiungere prodotti

Dalla PWA: nella sezione **Aggiungi prodotto** incolla il link Amazon (es. `https://www.amazon.it/dp/B08N5WRWNW`) oppure solo l'ASIN, facoltativamente un prezzo target (es. `49,90`), poi premi **Traccia**. Il prodotto va nella collezione Firestore `products` (un documento per ASIN) e compare subito nell'elenco, anche su altri dispositivi. Il primo prezzo arriva al controllo successivo (entro un'ora).

Formato di un documento `products/<ASIN>`:

| Campo | Tipo | Note |
|---|---|---|
| `asin` | string | 10 caratteri alfanumerici maiuscoli, uguale all'id del documento |
| `targetPrice` | number | facoltativo; quando il prezzo scende a questo valore o sotto, la card mostra "Sotto target" |
| `addedAt` | string (ISO) | data di inserimento |
| `archivedAt` | string (ISO) o `null` | `null` = tracciato. Una data = archiviato: non viene più scaricato, ma resta in lista con il suo storico |

**Rimuovi** nella PWA archivia (imposta `archivedAt`), non cancella. **Ripristina** nella sezione Archivio riattiva il prodotto. Il campo `name` non va scritto a mano: viene preso dalla pagina Amazon.

## Configurazione

Serve solo Firebase. Il sito funziona anche senza questi passi: in quel caso la lista e le notifiche non sono disponibili.

**1. Progetto Firebase e Firestore**

1. In [console.firebase.google.com](https://console.firebase.google.com) crea (o usa) un progetto.
2. **Build → Firestore Database → Create database** (modalità native).
3. **Firestore → Rules**: incolla il contenuto di `firestore.rules` e premi **Publish**. Le regole non vengono pubblicate dal workflow.

**2. Configurazione dell'app web**

1. **Project settings → General → Your apps → Web (`</>`)**: registra un'app web. Annota `apiKey`, `projectId`, `messagingSenderId`, `appId`.
2. **Project settings → Cloud Messaging → Web configuration → Web Push certificates → Generate key pair**. Annota la chiave pubblica (VAPID).

**3. Variabili pubbliche `VITE_*` (repository variables)**

In GitHub: **Settings → Secrets and variables → Actions → Variables → New repository variable**. Crea queste cinque variabili (sono pubbliche per design, non sono segreti):

| Nome | Valore |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |
| `VITE_FIREBASE_VAPID_KEY` | chiave pubblica Web Push |

Il workflow Pages le passa al build. Se mancano, la PWA mostra "Firebase non configurato in questa build".

**4. Secret `FIREBASE_SERVICE_ACCOUNT` (per il job orario)**

1. **Project settings → Service accounts → Generate new private key**: scarica il JSON. Contiene una chiave privata: non committarlo.
2. In GitHub: **Settings → Secrets and variables → Actions → Secrets → New repository secret**. Nome `FIREBASE_SERVICE_ACCOUNT`, valore: l'intero contenuto del JSON.
3. Cancella il file JSON dal computer.

Senza il secret il job non può leggere la lista prodotti: scrive un avviso nel log e non modifica `prices.json`.

**Verifica**

1. Dalla PWA aggiungi un prodotto: deve comparire nell'elenco e nella console Firestore, collezione `products`.
2. **Actions → Update prices → Run workflow**: nel log deve comparire `→ <prezzo>` per ogni prodotto attivo.
3. Premi **Attiva notifiche** e accetta il permesso. Su iPhone/iPad funziona solo dall'app installata con **Condividi → Aggiungi a Home**.
4. Al primo rilevamento di un prodotto non arriva nessuna notifica: serve un cambio di prezzo successivo.

**Tradeoff sulle regole Firestore**

La collezione `products` è leggibile e scrivibile da chiunque abbia la configurazione web pubblica. È una scelta esplicita: il gate con password è solo una facciata lato client (vedi sotto), quindi non può proteggere i dati. Le regole limitano la forma dei documenti (campi ammessi, `asin` uguale all'id, date ISO) ma non l'autore. Chiunque conosca il progetto può aggiungere o archiviare prodotti. La collezione `devices` non è leggibile dai client.

## Deploy su GitHub

1. Crea il repository su GitHub a mano (il progetto non lo crea da solo) e pusha questo progetto sul branch `main`. Il comando per farlo verrà indicato separatamente.
2. In **Settings → Pages**, imposta **Source** su **GitHub Actions**.
3. In **Settings → Actions → General**, assicurati che i workflow abbiano permessi di scrittura sul contenuto (il job di aggiornamento committa `data/prices.json`).
4. Completa la sezione Configurazione.
5. Lancia manualmente **Actions → Update prices → Run workflow** per il primo aggiornamento; il deploy parte automaticamente al termine.

L'URL della PWA sarà `https://<utente>.github.io/<repo>/`. Su smartphone, apri l'URL nel browser e scegli "Aggiungi a schermata Home".

I workflow usano Node 24 (`actions/setup-node`, cache npm su `package-lock.json`). Il job di aggiornamento esegue `npm ci` (per `firebase-admin`), il deploy esegue `npm ci`, `npm test` e `npm run build` prima di pubblicare.

### Accesso con password

La PWA mostra una schermata di accesso ("A cracker"). È solo una facciata lato client: i dati sono pubblici e chiunque può leggere il bundle, quindi non va considerata una protezione reale. Nel sorgente c'è solo l'hash SHA-256 della password (`PASSWORD_SHA256` in `src/lib/gate.js`), mai il testo in chiaro. Per cambiare password:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('nuova-password','utf8').digest('hex'))"
```

Copia l'output in `PASSWORD_SHA256`, poi esegui `npm test` (il test verifica che la password non compaia in `src/` né in `dist/assets/`). Lo sblocco vale per la sessione del browser (`sessionStorage`, chiave `a-cracker-ok`). Il confronto usa `crypto.subtle`, quindi il gate funziona solo in contesto sicuro (HTTPS o `localhost`).

## Struttura

- `src/` – PWA in Svelte 5 (entry `index.html`, `main.js`, `App.svelte`, `components/`, `styles.css`).
  - `src/lib/` – `firebase.js` (config, Firestore, notifiche), `products-store.js` (lista su Firestore), `product-list.js` (regole: aggiungi/archivia/ripristina, errori Firestore), `amazon-link.js` (ASIN dal link), `push-support.js`, `data.js` (prezzi), `stats.mjs`, `gate.js`.
- `public/` – file copiati così come sono nel build: `sw.js` (service worker offline), `firebase-messaging-sw.js` (notifiche in background), `manifest.webmanifest`, `icons/`.
- `data/prices.json` – storico dei prezzi, generato dal job e versionato in git. Vite lo copia in `dist/data/` durante il build.
- `firestore.rules` – regole per `products` e `devices` (da pubblicare in Firebase).
- `.env.example` – nomi delle variabili `VITE_FIREBASE_*` (senza valori).
- `vite.config.js` – configurazione Vite (`base: './'` per GitHub Pages in sottocartella).
- `dist/` – output del build (generato, non versionato): viene pubblicato da GitHub Pages.
- `scripts/` – `update-prices.mjs` (job orario), `serve.mjs`, `make-icons.mjs`. La logica pura è in `scripts/lib/` (`history.mjs`, `products.mjs`, `notifications.mjs`, `parse-price.mjs`); l'accesso a Firebase Admin in `scripts/lib/firebase-admin.mjs`.
- `test/` – test con `node:test` (incluso un test che verifica il contenuto di `dist/`).
- `.github/workflows/` – aggiornamento prezzi (ogni ora, `17 * * * *`) e deploy su Pages.
- `.claude/agents/` – agenti di progetto (analyst, developer, reviewer) per lo sviluppo assistito.
