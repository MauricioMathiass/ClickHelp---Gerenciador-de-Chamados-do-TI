// Limita as tentativas de login erradas para barrar ataques de força bruta.
// A chave junta IP e usuário: quem erra a senha bloqueia só a si mesmo, e não
// consegue trancar o acesso de outra pessoa a partir do próprio IP.
// Fica em memória: o Render roda uma única instância, e reiniciar zera tudo.

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 10000;

const failures = new Map();

const keyFor = (ip, username) =>
  `${ip ?? ""}|${String(username ?? "")
    .trim()
    .toLowerCase()}`;

const activeEntry = (key, now) => {
  const entry = failures.get(key);

  if (entry && now - entry.firstFailureAt >= LOCK_WINDOW_MS) {
    failures.delete(key);
    return null;
  }

  return entry ?? null;
};

/** Minutos que faltam para liberar o login, ou 0 se não estiver bloqueado. */
export const getLockMinutes = (ip, username, now = Date.now()) => {
  const entry = activeEntry(keyFor(ip, username), now);

  if (!entry || entry.count < MAX_FAILED_ATTEMPTS) {
    return 0;
  }

  return Math.max(1, Math.ceil((entry.firstFailureAt + LOCK_WINDOW_MS - now) / 60000));
};

export const registerFailure = (ip, username, now = Date.now()) => {
  const key = keyFor(ip, username);
  const entry = activeEntry(key, now);

  if (!entry && failures.size >= MAX_TRACKED_KEYS) {
    // Limpa o que já expirou para a memória não crescer sem limite.
    for (const [storedKey, stored] of failures) {
      if (now - stored.firstFailureAt >= LOCK_WINDOW_MS) {
        failures.delete(storedKey);
      }
    }
  }

  failures.set(key, { count: (entry?.count ?? 0) + 1, firstFailureAt: entry?.firstFailureAt ?? now });
};

export const clearFailures = (ip, username) => {
  failures.delete(keyFor(ip, username));
};
