/**
 * Validates a phone number format
 * Supports various formats: (123) 456-7890, 123-456-7890, +1 123 456 7890
 */
export function validatePhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Remove all non-digit characters except + at the start
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Check for valid length (10-15 digits, optionally starting with +)
  const phoneRegex = /^\+?\d{10,15}$/;
  return phoneRegex.test(cleaned);
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}
