import crypto from 'crypto';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const left = crypto.createHash('sha256').update(String(a)).digest();
  const right = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

export function hmacSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', String(secret)).update(String(body)).digest('hex');
}

export function verifyHmacSignature(signatureHeader: string, rawBody: string, secret: string): boolean {
  if (!signatureHeader) return false;
  const prefix = 'sha256=';
  if (!signatureHeader.startsWith(prefix)) return false;
  const provided = signatureHeader.slice(prefix.length);
  if (!/^[a-f0-9]{64}$/i.test(provided)) return false;
  const expected = hmacSignature(rawBody, secret);
  return timingSafeEqualStr(provided, expected);
}

export function isPlaceholderCredential(value: string | undefined): boolean {
  if (!value) return true;
  const normalized = value.toUpperCase();
  return (
    value === 'CHANGE-ME' ||
    normalized.includes('YOUR-') ||
    normalized.includes('CHANGE-THIS') ||
    normalized.includes('REPLACE') ||
    normalized.includes('PLACEHOLDER') ||
    normalized.includes('CHANGEME')
  );
}