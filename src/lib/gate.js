// Accesso con password statica: solo una facciata lato client.
// Nel sorgente e nel bundle c'è solo l'hash SHA-256 della password, mai il testo in chiaro.
// I dati sono pubblici, quindi questo non è un controllo di sicurezza vero.

export const PASSWORD_SHA256 = 'f106e246ecdab88cb2262780f60079651aeaa6a3c8f5b1e75fc2ab0582cd3f67';

export const SESSION_KEY = 'a-cracker-ok';

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function checkPassword(input) {
  return (await sha256Hex(input)) === PASSWORD_SHA256;
}

// Lo storage può mancare (modalità privata, cookie bloccati): in quel caso il gate chiede la password a ogni visita.
export function isUnlocked() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function markUnlocked() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Storage non disponibile: l'accesso resta valido per la pagina corrente.
  }
}
