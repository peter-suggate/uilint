/**
 * Check if the given input is a valid email format
 */
export const checkEmailFormat = (input: string): boolean => {
  if (!input) return false;

  const pattern = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
  return pattern.test(input.trim().toLowerCase());
};
