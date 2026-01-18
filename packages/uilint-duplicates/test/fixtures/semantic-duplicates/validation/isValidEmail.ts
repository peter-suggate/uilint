/**
 * Determines whether a string is a properly formatted email address
 */
export default function isValidEmail(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  // RFC 5322 simplified regex
  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  return emailPattern.test(value);
}
