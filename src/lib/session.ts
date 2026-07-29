/**
 * Estado de sesión que muestra la cabecera. Vive fuera del componente porque es
 * lo único testeable de `SessionMenu`, que por lo demás es JSX y un efecto.
 */

/** `unknown` es el primer render: todavía no se resolvió si hay sesión. */
export type SessionState =
  | { kind: 'unknown' }
  | { kind: 'anonymous' }
  | { kind: 'student'; email: string; label: string };

/** Etiqueta corta para la cabecera; el correo completo va en el `title`. */
export function accountLabel(email: string): string {
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : email;
}

/**
 * `sub` es lo que decide si hay sesión: es la única claim que el token siempre
 * trae. El correo puede faltar y eso no vuelve anónimo a nadie.
 */
export function sessionFromClaims(claims: unknown): SessionState {
  if (typeof claims !== 'object' || claims === null) return { kind: 'anonymous' };

  const { sub, email } = claims as { sub?: unknown; email?: unknown };
  if (typeof sub !== 'string' || sub === '') return { kind: 'anonymous' };

  const address = typeof email === 'string' ? email : '';

  return {
    kind: 'student',
    email: address,
    label: address ? accountLabel(address) : 'Mi cuenta',
  };
}
