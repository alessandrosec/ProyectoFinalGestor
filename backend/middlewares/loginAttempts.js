//loginAttempts
const attempts = {};
const LIMIT = 5;
const BLOCK_TIME_MS = 5 * 60 * 1000; // 5 minutos

function registerFailedAttempt(email) {
  const now = Date.now();
  if (!attempts[email]) {
    attempts[email] = { count: 1, lastAttempt: now, blockedUntil: null };
  } else {
    attempts[email].count += 1;
    attempts[email].lastAttempt = now;

    if (attempts[email].count >= LIMIT) {
      attempts[email].blockedUntil = now + BLOCK_TIME_MS;
    }
  }
}

function isBlocked(email) {
  const data = attempts[email];
  if (!data) return false;

  if (data.blockedUntil && data.blockedUntil > Date.now()) {
    return true;
  }

  // Si ya expiró el bloqueo, limpiamos datos
  if (data.blockedUntil && data.blockedUntil <= Date.now()) {
    delete attempts[email];
    return false;
  }

  return false;
}

function resetAttempts(email) {
  delete attempts[email];
}

module.exports = {
  registerFailedAttempt,
  isBlocked,
  resetAttempts
};
