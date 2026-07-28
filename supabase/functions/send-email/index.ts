// Send Email Hook: Supabase Auth delega aquí todos sus correos y los mandamos
// por Resend con nuestras propias plantillas.
//
// Supabase firma cada request con el estándar Standard Webhooks, así que la
// función es pública (verify_jwt = false) pero solo acepta payloads firmados
// con SEND_EMAIL_HOOK_SECRET.
//
// Docs: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import React from "react";
import { Webhook } from "standardwebhooks";
import { Resend } from "resend";
import { renderAsync } from "@react-email/components";
import { AuthEmail } from "./_templates/auth-email.tsx";
import { COPY, FALLBACK_COPY, type EmailActionType } from "./_templates/copy.ts";

type HookPayload = {
  user: {
    email: string;
    new_email?: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    token_new: string;
    token_hash_new: string;
  };
};

/** Un correo listo para entregarle a Resend. */
type OutgoingEmail = {
  to: string;
  token: string;
  tokenHash: string;
};

// Los avisos informan de algo que ya pasó, no hay nada que verificar.
const NOTIFICATION_ONLY = new Set<EmailActionType>([
  "reauthentication",
  "password_changed_notification",
  "email_changed_notification",
  "phone_changed_notification",
  "identity_linked_notification",
  "identity_unlinked_notification",
  "mfa_factor_enrolled_notification",
  "mfa_factor_unenrolled_notification",
]);

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

function buildVerifyUrl(
  supabaseUrl: string,
  tokenHash: string,
  actionType: EmailActionType,
  redirectTo: string,
): string {
  const url = new URL("/auth/v1/verify", supabaseUrl);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", actionType);
  if (redirectTo) {
    url.searchParams.set("redirect_to", redirectTo);
  }
  return url.toString();
}

/**
 * Decide a qué direcciones va el correo y con qué token cada una.
 *
 * El caso interesante es `email_change` con Secure Email Change activo: se
 * generan dos OTP y hay que mandar dos correos. Ojo con el nombre de los
 * campos, que está invertido por retrocompatibilidad —`token_hash_new` es el
 * de la dirección *actual*, no el de la nueva.
 */
function resolveRecipients({ user, email_data }: HookPayload): OutgoingEmail[] {
  const { email_action_type, token, token_hash, token_new, token_hash_new } =
    email_data;

  if (email_action_type === "email_change" && user.new_email) {
    const recipients: OutgoingEmail[] = [
      { to: user.new_email, token: token_new || token, tokenHash: token_hash },
    ];
    // Solo con Secure Email Change activo llega el segundo par de tokens.
    if (token_hash_new) {
      recipients.push({
        to: user.email,
        token,
        tokenHash: token_hash_new,
      });
    }
    return recipients;
  }

  return [{ to: user.email, token, tokenHash: token_hash }];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 405 });
  }

  let payload: HookPayload;
  try {
    const body = await req.text();
    const headers = Object.fromEntries(req.headers);
    const secret = requireEnv("SEND_EMAIL_HOOK_SECRET").replace(
      "v1,whsec_",
      "",
    );
    payload = new Webhook(secret).verify(body, headers) as HookPayload;
  } catch (error) {
    console.error("Firma inválida o secreto mal configurado:", error);
    return jsonError(401, "Firma del webhook inválida");
  }

  try {
    const { user, email_data } = payload;
    const actionType = email_data.email_action_type;
    const copy = COPY[actionType] ?? FALLBACK_COPY;

    const resend = new Resend(requireEnv("RESEND_API_KEY"));
    const from = requireEnv("AUTH_EMAIL_FROM");
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const siteUrl = email_data.site_url || undefined;

    const emails = resolveRecipients(payload);

    await Promise.all(
      emails.map(async ({ to, token, tokenHash }) => {
        const actionUrl = NOTIFICATION_ONLY.has(actionType)
          ? undefined
          : buildVerifyUrl(
              supabaseUrl,
              tokenHash,
              actionType,
              email_data.redirect_to,
            );

        const html = await renderAsync(
          React.createElement(AuthEmail, { copy, actionUrl, token, siteUrl }),
        );

        const { error } = await resend.emails.send({
          from,
          to: [to],
          subject: copy.subject,
          html,
        });
        if (error) {
          throw new Error(`Resend rechazó el envío a ${to}: ${error.message}`);
        }
      }),
    );

    console.log(
      `Enviado "${actionType}" a ${emails.length} destinatario(s) (usuario ${user.email})`,
    );
  } catch (error) {
    console.error("No se pudo enviar el correo:", error);
    return jsonError(
      500,
      error instanceof Error ? error.message : "Error desconocido",
    );
  }

  // Supabase toma cualquier 200 con cuerpo vacío como éxito.
  return new Response("{}", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

function jsonError(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: { http_code: status, message } }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}
