<script>
  import { parseAsin } from '../lib/amazon-link.js';
  import { parseTargetPrice } from '../lib/product-list.js';

  // onadd({ asin, targetPrice }) writes the list and rejects with an Error message when it fails.
  let { onadd } = $props();

  let link = $state('');
  let target = $state('');
  let busy = $state(false);
  let message = $state('');
  let messageKind = $state('');

  function fail(text) {
    messageKind = 'error';
    message = text;
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    message = '';

    const asin = parseAsin(link);
    if (!asin) {
      fail('Link Amazon non riconosciuto. Incolla il link completo del prodotto, ad esempio amazon.it/dp/B08N5WRWNW.');
      return;
    }
    let targetPrice;
    try {
      targetPrice = parseTargetPrice(target);
    } catch (err) {
      fail(err.message);
      return;
    }

    busy = true;
    message = 'Salvataggio in corso…';
    messageKind = 'status';
    try {
      await onadd({ asin, targetPrice });
      link = '';
      target = '';
      messageKind = 'ok';
      message = 'Prodotto aggiunto. Il primo prezzo comparirà al prossimo controllo, entro un\'ora.';
    } catch (err) {
      fail(err.message);
    } finally {
      busy = false;
    }
  }
</script>

<section class="panel">
  <h2>Aggiungi prodotto</h2>
  <form onsubmit={submit}>
    <label for="amazon-link">Incolla il link Amazon</label>
    <input
      id="amazon-link"
      type="url"
      inputmode="url"
      autocomplete="off"
      spellcheck="false"
      placeholder="https://www.amazon.it/dp/…"
      bind:value={link}
      disabled={busy}
      required
    />
    <label for="target-price">Prezzo target (facoltativo)</label>
    <input
      id="target-price"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      placeholder="es. 49,90"
      bind:value={target}
      disabled={busy}
    />
    <button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Attendi…' : 'Traccia'}</button>
    {#if message}
      <p class={messageKind} role={messageKind === 'error' ? 'alert' : 'status'}>{message}</p>
    {/if}
  </form>
</section>
