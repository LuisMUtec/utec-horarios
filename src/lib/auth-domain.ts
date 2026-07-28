/** Único dominio de correo con el que se puede iniciar sesión. */
export const ALLOWED_EMAIL_DOMAIN = 'utec.edu.pe';

/**
 * Valida que el correo pertenezca al dominio institucional.
 *
 * Compara el dominio completo, no un sufijo: `endsWith` dejaría pasar
 * `alguien@notutec.edu.pe`. Y toma el segmento después de la ÚLTIMA `@`, que es
 * el dominio real según RFC 5321, para que `"a@evil.com"@utec.edu.pe` no cuele.
 * Los subdominios (`@alumno.utec.edu.pe`) tampoco pasan: la allowlist es exacta.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  return email.slice(at + 1).trim().toLowerCase() === ALLOWED_EMAIL_DOMAIN;
}
