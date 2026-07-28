/**
 * Armar el horario tiene que sobrevivir a que Supabase no esté: el job `build`
 * del CI corre sin secretos y `docs/auth.md` lo promete. Cuando esto devuelve
 * `false`, la app renderiza exactamente como antes de las reseñas.
 *
 * Los nombres van literales y no por variable: Next reemplaza `NEXT_PUBLIC_*`
 * en tiempo de build por coincidencia textual, así que un acceso dinámico
 * llegaría al navegador como `undefined`.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
