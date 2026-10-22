# Amazon Price Tracker

PWA statica che mostra l'andamento dei prezzi di una lista di prodotti Amazon. I prezzi vengono aggiornati ogni 6 ore da GitHub Actions e pubblicati su GitHub Pages. Vedi [docs/analysis.md](docs/analysis.md) per vincoli, architettura e rischi (in particolare: lo scraping di Amazon è contro le sue Condizioni d'uso).

## Setup locale

Requisito: Node.js 20.19 o superiore (Vite 8). Prima del primo uso installa le dipendenze di sviluppo:

```bash
npm install             # Svelte 5, Vite 8, @sveltejs/vite-plugin-svelte
npm test            # test unitari e test del build
npm run build       # build della PWA in dist/
npm run update-prices   # scarica i prezzi (richiede rete e prodotti in data/products.json)
npm run serve       # build di dist/ e server su http://localhost:8080
npm run icons       # rigenera le icone PWA (solo se cambi il disegno)
```

## Aggiungere prodotti

Modifica `data/products.json`:

```json
[
  { "asin": "B08N5WRWNW", "name": "Nome facoltativo", "targetPrice": 49.9 }
]
```

- `asin`: 10 caratteri alfanumerici maiuscoli, si trova nell'URL del prodotto (`amazon.it/dp/ASIN`).
- `targetPrice`: facoltativo; quando il prezzo scende a questo valore o sotto, la card mostra "Sotto target".

## Deploy su GitHub

1. Crea il repository su GitHub a mano (il progetto non lo crea da solo) e pusha questo progetto sul branch `main`. Il comando per farlo verrà indicato separatamente.
2. In **Settings → Pages**, imposta **Source** su **GitHub Actions**.
3. In **Settings → Actions → General**, assicurati che i workflow abbiano permessi di scrittura sul contenuto (il job di aggiornamento committa `data/prices.json`).
4. Lancia manualmente **Actions → Update prices → Run workflow** per il primo aggiornamento; il deploy parte automaticamente al termine.

L'URL della PWA sarà `https://<utente>.github.io/<repo>/`. Su smartphone, apri l'URL nel browser e scegli "Aggiungi a schermata Home".

I workflow usano Node 24 (`actions/setup-node`, cache npm su `package-lock.json`). Il deploy esegue `npm ci`, `npm test` e `npm run build` prima di pubblicare.

### Accesso con password

La PWA mostra una schermata di accesso ("A cracker"). È solo una facciata lato client: i dati sono pubblici e chiunque può leggere il bundle, quindi non va considerata una protezione reale. Nel sorgente c'è solo l'hash SHA-256 della password (`PASSWORD_SHA256` in `src/lib/gate.js`), mai il testo in chiaro. Per cambiare password:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('nuova-password','utf8').digest('hex'))"
```

Copia l'output in `PASSWORD_SHA256`, poi esegui `npm test` (il test verifica che la password non compaia in `src/` né in `dist/assets/`). Lo sblocco vale per la sessione del browser (`sessionStorage`, chiave `a-cracker-ok`). Il confronto usa `crypto.subtle`, quindi il gate funziona solo in contesto sicuro (HTTPS o `localhost`).

## Struttura

- `src/` – PWA in Svelte 5 (entry `index.html`, `main.js`, `App.svelte`, `components/`, `styles.css`). La logica di presentazione pura è in `src/lib/` (`stats.mjs`), il caricamento dati in `src/lib/data.js`.
- `public/` – file copiati così come sono nel build: `sw.js` (service worker), `manifest.webmanifest`, `icons/`.
- `data/` – `products.json` (lista, modificata a mano) e `prices.json` (storico, generato dal job). Vite lo copia in `dist/data/` durante il build.
- `vite.config.js` – configurazione Vite (`base: './'` per GitHub Pages in sottocartella).
- `dist/` – output del build (generato, non versionato): viene pubblicato da GitHub Pages.
- `scripts/` – aggiornamento prezzi, server locale, icone. La logica pura del job è in `scripts/lib/`.
- `test/` – test con `node:test` (incluso un test che verifica il contenuto di `dist/`).
- `.github/workflows/` – aggiornamento prezzi e deploy su Pages.
- `.claude/agents/` – agenti di progetto (analyst, developer, reviewer) per lo sviluppo assistito.
