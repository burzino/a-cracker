<script>
  import { enablePushNotifications } from '../lib/firebase.js';

  let busy = $state(false);
  let result = $state(null);

  async function activate() {
    if (busy) return;
    busy = true;
    result = null;
    result = await enablePushNotifications();
    busy = false;
  }
</script>

<section class="panel">
  <h2>Notifiche</h2>
  <p class="muted">Ricevi un avviso quando il prezzo di un prodotto tracciato cambia.</p>
  <button type="button" class="btn-secondary" onclick={activate} disabled={busy}>
    {busy ? 'Attivazione…' : 'Attiva notifiche'}
  </button>
  {#if result}
    <p class={result.ok ? 'ok' : 'error'} role={result.ok ? 'status' : 'alert'}>{result.message}</p>
  {/if}
</section>
