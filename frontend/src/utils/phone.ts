/**
 * Phone and Super Admin Authorization Utilities
 */

export const normalizePhone = (raw?: string | null): string => {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('856')) {
    digits = digits.substring(3);
  }
  if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  return digits;
};

export const isPhoneMatch = (phone1?: string | null, phone2?: string | null): boolean => {
  const n1 = normalizePhone(phone1);
  const n2 = normalizePhone(phone2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  if (n1.endsWith(n2) || n2.endsWith(n1)) {
    const minLen = Math.min(n1.length, n2.length);
    if (minLen >= 8) {
      return true;
    }
  }
  return false;
};

export const isSuperAdmin = (u?: { role?: string; phone?: string } | null): boolean => {
  if (!u) return false;
  if (u.role === 'admin') return true;
  if (!u.phone) return false;
  const p = u.phone.toLowerCase().trim();
  if (p === 'admin') return true;
  return isPhoneMatch(p, '02054245616') || isPhoneMatch(p, '02055555555');
};
