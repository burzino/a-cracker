<script>
  import { checkPassword, markUnlocked } from '../lib/gate.js';

  let { onunlock } = $props();

  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    error = '';
    try {
      if (await checkPassword(password)) {
        markUnlocked();
        onunlock();
      } else {
        error = 'Password errata';
      }
    } catch {
      // crypto.subtle esiste solo in contesto sicuro (HTTPS o localhost).
      error = 'Impossibile verificare la password (serve HTTPS o localhost)';
    } finally {
      busy = false;
    }
  }
</script>

<main class="gate">
  <h1>A cracker</h1>
  <form onsubmit={submit}>
    <label for="gate-password">Password</label>
    <input
      id="gate-password"
      type="password"
      autocomplete="current-password"
      bind:value={password}
      required
    />
    <button type="submit" disabled={busy}>Entra</button>
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
  </form>
</main>

<style>
  .gate {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 16px;
    box-sizing: border-box;
  }

  h1 {
    margin: 0 0 24px;
    font-size: 1.6rem;
  }

  form {
    width: 100%;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  label {
    color: var(--muted);
    font-size: 0.9rem;
  }

  input {
    font: inherit;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
  }

  button {
    font: inherit;
    padding: 10px 12px;
    border: 0;
    border-radius: 8px;
    background: var(--accent);
    color: #fff;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .error {
    margin: 4px 0 0;
    color: var(--bad);
  }
</style>
