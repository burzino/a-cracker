<script>
  import { sparklinePoints } from '../lib/stats.mjs';

  const SPARKLINE = { width: 300, height: 60 };

  let { history } = $props();

  const points = $derived(sparklinePoints(history, SPARKLINE.width, SPARKLINE.height));
</script>

<svg
  class="sparkline"
  viewBox="0 0 {SPARKLINE.width} {SPARKLINE.height}"
  preserveAspectRatio="none"
  role="img"
  aria-label="Andamento del prezzo">
  <polyline {points} />
</svg>
