export function sendValidationError(res, message, details = null) {
  return res.status(400).json({ error: 'Invalid request', message, details });
}

export function sendServerError(res, message, error) {
  return res.status(500).json({ error: message, details: error?.message ?? 'Unknown server error' });
}

export function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
