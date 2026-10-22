<script>
  import { formatEUR } from '../lib/stats.mjs';

  let { history } = $props();

  // Newest first.
  const rows = $derived([...history].reverse());
</script>

<details class="history">
  <summary>Storico ({history.length} variazioni)</summary>
  <table>
    <tbody>
      {#each rows as point}
        <tr>
          <td>{new Date(point.date).toLocaleDateString('it-IT')}</td>
          <td>{formatEUR(point.price)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</details>
