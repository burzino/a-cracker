<script>
  import ProductCard from './components/ProductCard.svelte';
  import Gate from './components/Gate.svelte';
  import { loadData } from './lib/data.js';
  import { isUnlocked } from './lib/gate.js';

  let unlocked = $state(false);
  let products = $state(null);
  let prices = $state(null);
  let loadError = $state(null);
  let loadStarted = false;

  // I dati si caricano solo dopo lo sblocco del gate.
  function startLoad() {
    if (loadStarted) return;
    loadStarted = true;
    loadData()
      .then((data) => {
        products = data.products;
        prices = data.prices;
      })
      .catch((err) => {
        loadError = err.message;
      });
  }

  function unlock() {
    unlocked = true;
    startLoad();
  }

  if (isUnlocked()) unlock();

  const status = $derived.by(() => {
    if (loadError) return `Impossibile caricare i dati (${loadError})`;
    if (!products) return 'Caricamento…';
    return prices?.updatedAt
      ? `Ultima variazione: ${new Date(prices.updatedAt).toLocaleString('it-IT')}`
      : 'Nessun dato ancora disponibile';
  });
</script>

{#if unlocked}
  <header class="app-header">
    <h1>Amazon Price Tracker</h1>
    <p class="status">{status}</p>
  </header>

  <main class="list" aria-live="polite">
    {#if products}
      {#if products.length === 0}
        <p class="empty">Nessun prodotto tracciato. Aggiungi un ASIN in data/products.json.</p>
      {:else}
        {#each products as product (product.asin)}
          <ProductCard {product} item={prices?.items?.[product.asin]} />
        {/each}
      {/if}
    {/if}
  </main>
{:else}
  <Gate onunlock={unlock} />
{/if}
