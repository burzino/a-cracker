<script>
  import { onDestroy } from 'svelte';
  import ProductCard from './components/ProductCard.svelte';
  import Gate from './components/Gate.svelte';
  import AddProduct from './components/AddProduct.svelte';
  import NotifyButton from './components/NotifyButton.svelte';
  import { loadPrices } from './lib/data.js';
  import { isUnlocked } from './lib/gate.js';
  import { FIREBASE_CONFIGURED, FIREBASE_NOT_CONFIGURED } from './lib/firebase.js';
  import { activeProducts, archivedProducts } from './lib/product-list.js';
  import {
    archiveTrackedProduct,
    restoreTrackedProduct,
    subscribeProducts,
    trackProduct,
  } from './lib/products-store.js';

  let unlocked = $state(false);
  let products = $state(null); // null until the first snapshot arrives
  let prices = $state(null);
  let loadError = $state(null);
  let productsError = $state('');
  let actionError = $state('');
  let loadStarted = false;
  // subscribeProducts is async: the unsubscribe function arrives after the listener is set up.
  let unsubscribeProducts = null;
  let destroyed = false;

  const active = $derived(products ? activeProducts(products) : []);
  const archived = $derived(products ? archivedProducts(products) : []);

  // The product list is live from Firestore (onSnapshot), so changes from other devices appear on their own.
  // Prices come from the published data/prices.json.
  function startLoad() {
    if (loadStarted) return;
    loadStarted = true;
    loadPrices()
      .then((data) => {
        prices = data;
      })
      .catch((err) => {
        loadError = err.message;
      });
    if (!FIREBASE_CONFIGURED) return;
    subscribeProducts(
      (list) => {
        products = list;
        productsError = '';
      },
      (err) => {
        productsError = err.message;
      },
    ).then((unsubscribe) => {
      if (destroyed) unsubscribe();
      else unsubscribeProducts = unsubscribe;
    });
  }

  onDestroy(() => {
    destroyed = true;
    unsubscribeProducts?.();
  });

  function unlock() {
    unlocked = true;
    startLoad();
  }

  async function run(action) {
    actionError = '';
    try {
      await action();
    } catch (err) {
      actionError = err.message;
    }
  }

  if (isUnlocked()) unlock();

  const status = $derived.by(() => {
    if (!FIREBASE_CONFIGURED) return FIREBASE_NOT_CONFIGURED;
    if (productsError) return productsError;
    if (!products) return 'Caricamento…';
    return prices?.updatedAt
      ? `Ultima variazione prezzi: ${new Date(prices.updatedAt).toLocaleString('it-IT')}`
      : 'Nessun prezzo ancora disponibile';
  });
</script>

{#if unlocked}
  <header class="app-header">
    <h1>Amazon Price Tracker</h1>
    <p class="status">{status}</p>
  </header>

  <main class="list" aria-live="polite">
    {#if FIREBASE_CONFIGURED}
      <!-- Adding waits for the list: otherwise a duplicate check could miss an archived product and overwrite it. -->
      <AddProduct
        onadd={(input) => {
          if (!products) throw new Error('La lista prodotti non è ancora caricata: riprova tra un istante.');
          return trackProduct(input);
        }}
      />
    {:else}
      <section class="panel">
        <h2>Firebase non configurato</h2>
        <p class="muted">
          Questa build non ha la configurazione Firebase (variabili <code>VITE_FIREBASE_*</code>).
          La lista prodotti e le notifiche non sono disponibili. Vedi la sezione Configurazione del README.
        </p>
      </section>
    {/if}

    {#if actionError}
      <p class="error panel-error" role="alert">{actionError}</p>
    {/if}
    {#if loadError}
      <p class="error panel-error" role="alert">Prezzi non caricati: {loadError}</p>
    {/if}

    {#if FIREBASE_CONFIGURED}
      <NotifyButton />
    {/if}

    <section class="section">
      <h2>Tracciati</h2>
      {#if productsError}
        <p class="error" role="alert">{productsError}</p>
      {:else if !products}
        <p class="empty">Caricamento…</p>
      {:else if active.length === 0}
        <p class="empty">Nessun prodotto tracciato. Incolla un link Amazon qui sopra.</p>
      {:else}
        {#each active as product (product.asin)}
          <ProductCard
            {product}
            item={prices?.items?.[product.asin]}
            onremove={(asin) => run(() => archiveTrackedProduct(products, asin))}
          />
        {/each}
      {/if}
    </section>

    <details class="archive">
      <summary>Archivio ({archived.length})</summary>
      {#if archived.length === 0}
        <p class="empty">Nessun prodotto archiviato.</p>
      {:else}
        <ul class="archive-list">
          {#each archived as product (product.asin)}
            <li>
              <span class="archive-name">{prices?.items?.[product.asin]?.name ?? product.name ?? product.asin}</span>
              <button type="button" class="btn-secondary" onclick={() => run(() => restoreTrackedProduct(products, product.asin))}>
                Ripristina
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </details>
  </main>
{:else}
  <Gate onunlock={unlock} />
{/if}
