// Explains why push notifications cannot be enabled here, or returns null when they can. Pure: the caller reads
// the browser state and passes it in.
export function pushUnavailableReason({ configured, hasNotification, hasServiceWorker, hasPushManager, isIOS, standalone }) {
  if (!configured) return 'Notifiche non configurate in questa build.';
  if (isIOS && !standalone) {
    return 'Su iPhone e iPad le notifiche funzionano solo dall\'app installata: tocca Condividi → "Aggiungi a Home", apri l\'app da lì e riprova.';
  }
  if (!hasNotification || !hasServiceWorker || !hasPushManager) {
    return 'Questo browser non supporta le notifiche push.';
  }
  return null;
}

export function permissionDeniedMessage() {
  return 'Notifiche bloccate: riabilitale nelle impostazioni del browser per questo sito.';
}
