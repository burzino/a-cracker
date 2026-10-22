<script>
  import { formatEUR, isBelowTarget, summarize } from '../lib/stats.mjs';
  import Sparkline from './Sparkline.svelte';
  import PriceHistory from './PriceHistory.svelte';

  let { product, item, onremove = null } = $props();

  const history = $derived(item?.history ?? []);
  const stats = $derived(summarize(history));
  const current = $derived(item?.current ?? null);
  const lastPoint = $derived(history.at(-1) ?? null);
</script>

<article class="card">
  <h2 class="card-title">{item?.name ?? product.name ?? product.asin}</h2>

  <div class="price-row">
    <span class="price">{formatEUR(current)}</span>
    {#if isBelowTarget(current, product.targetPrice)}
      <span class="badge">Sotto target</span>
    {/if}
    {#if lastPoint}
      <span class="checked">Prezzo del {new Date(lastPoint.date).toLocaleDateString('it-IT')}</span>
    {/if}
  </div>

  {#if product.targetPrice !== undefined}
    <p class="target">Target: {formatEUR(product.targetPrice)}</p>
  {/if}

  {#if stats}
    <p class="range">Minimo {formatEUR(stats.min)} · Massimo {formatEUR(stats.max)}</p>
    <Sparkline {history} />
    <PriceHistory {history} />
  {/if}

  {#if !item}
    <p class="checked">In attesa del primo controllo prezzi (ogni ora)</p>
  {/if}

  {#if item?.error}
    <p class="error">Ultimo aggiornamento non riuscito: {item.error}</p>
  {/if}

  <div class="card-actions">
    <a
      class="amazon-link"
      href="https://www.amazon.it/dp/{encodeURIComponent(product.asin)}"
      target="_blank"
      rel="noopener">Apri su Amazon</a>
    {#if onremove}
      <button type="button" class="btn-secondary" onclick={() => onremove(product.asin)}>Rimuovi</button>
    {/if}
  </div>
</article>
