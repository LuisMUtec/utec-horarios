// Textos de cada correo de autenticación, indexados por el `email_action_type`
// que manda el hook de Supabase. Los tipos terminados en `_notification` son
// avisos de "esto acaba de pasar en tu cuenta": no llevan enlace ni código.
//
// La lista de tipos posibles está en el JSON Schema del payload:
// https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook

export type EmailActionType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email"
  | "reauthentication"
  | "password_changed_notification"
  | "email_changed_notification"
  | "phone_changed_notification"
  | "identity_linked_notification"
  | "identity_unlinked_notification"
  | "mfa_factor_enrolled_notification"
  | "mfa_factor_unenrolled_notification";

export type EmailCopy = {
  subject: string;
  heading: string;
  intro: string;
  /** Texto del botón. Ausente en los avisos, que no tienen acción. */
  cta?: string;
  /** Línea final en gris, normalmente el "si no fuiste tú, ignora esto". */
  note?: string;
  /** Muestra el código de 6 dígitos como alternativa al enlace. */
  showToken?: boolean;
};

const IGNORAR = "Si no fuiste tú, puedes ignorar este correo.";
const AVISAR =
  "Si no reconoces este cambio, escríbenos de inmediato: tu cuenta puede estar comprometida.";

export const COPY: Record<EmailActionType, EmailCopy> = {
  signup: {
    subject: "Confirma tu correo · UTEC Horarios",
    heading: "Confirma tu correo",
    intro:
      "Ya casi. Confirma esta dirección para terminar de crear tu cuenta y guardar tus horarios.",
    cta: "Confirmar correo",
    note: "Si no creaste esta cuenta, puedes ignorar este correo.",
    showToken: true,
  },
  invite: {
    subject: "Te invitaron a UTEC Horarios",
    heading: "Te invitaron a UTEC Horarios",
    intro:
      "Alguien te invitó a crear una cuenta. Acepta la invitación para armar y guardar tu horario del semestre.",
    cta: "Aceptar invitación",
    note: "Si no esperabas esta invitación, puedes ignorar este correo.",
  },
  magiclink: {
    subject: "Tu enlace de acceso · UTEC Horarios",
    heading: "Tu enlace de acceso",
    intro:
      "Entra con el botón de abajo. El enlace caduca pronto y solo funciona una vez.",
    cta: "Iniciar sesión",
    note: IGNORAR,
    showToken: true,
  },
  recovery: {
    subject: "Restablece tu contraseña · UTEC Horarios",
    heading: "Restablece tu contraseña",
    intro:
      "Recibimos una solicitud para restablecer tu contraseña. Elige una nueva desde el botón de abajo.",
    cta: "Elegir nueva contraseña",
    note: `${IGNORAR} Tu contraseña actual seguirá funcionando.`,
    showToken: true,
  },
  email_change: {
    subject: "Confirma tu nuevo correo · UTEC Horarios",
    heading: "Confirma el cambio de correo",
    intro: "Confirma este cambio para seguir accediendo a tu cuenta.",
    cta: "Confirmar cambio",
    note: `${IGNORAR} El cambio no se aplicará.`,
    showToken: true,
  },
  email: {
    subject: "Confirma tu correo · UTEC Horarios",
    heading: "Confirma tu correo",
    intro: "Confirma esta dirección para continuar.",
    cta: "Confirmar correo",
    note: IGNORAR,
    showToken: true,
  },
  reauthentication: {
    subject: "Tu código de verificación · UTEC Horarios",
    heading: "Tu código de verificación",
    intro:
      "Usa este código para confirmar que eres tú. Caduca en unos minutos.",
    note: IGNORAR,
    showToken: true,
  },

  // Avisos: sin enlace ni código, solo informan de un cambio ya aplicado.
  password_changed_notification: {
    subject: "Tu contraseña cambió · UTEC Horarios",
    heading: "Tu contraseña cambió",
    intro: "Acabamos de actualizar la contraseña de tu cuenta.",
    note: AVISAR,
  },
  email_changed_notification: {
    subject: "Tu correo cambió · UTEC Horarios",
    heading: "Tu correo cambió",
    intro:
      "La dirección de correo asociada a tu cuenta acaba de actualizarse.",
    note: AVISAR,
  },
  phone_changed_notification: {
    subject: "Tu teléfono cambió · UTEC Horarios",
    heading: "Tu teléfono cambió",
    intro: "El número asociado a tu cuenta acaba de actualizarse.",
    note: AVISAR,
  },
  identity_linked_notification: {
    subject: "Vinculaste un nuevo inicio de sesión · UTEC Horarios",
    heading: "Vinculaste un nuevo inicio de sesión",
    intro:
      "Se conectó un nuevo proveedor de inicio de sesión a tu cuenta.",
    note: AVISAR,
  },
  identity_unlinked_notification: {
    subject: "Desvinculaste un inicio de sesión · UTEC Horarios",
    heading: "Desvinculaste un inicio de sesión",
    intro:
      "Se desconectó un proveedor de inicio de sesión de tu cuenta.",
    note: AVISAR,
  },
  mfa_factor_enrolled_notification: {
    subject: "Activaste verificación en dos pasos · UTEC Horarios",
    heading: "Activaste verificación en dos pasos",
    intro:
      "Se registró un nuevo factor de autenticación en tu cuenta.",
    note: AVISAR,
  },
  mfa_factor_unenrolled_notification: {
    subject: "Desactivaste un factor de verificación · UTEC Horarios",
    heading: "Desactivaste un factor de verificación",
    intro:
      "Se eliminó un factor de autenticación de tu cuenta.",
    note: AVISAR,
  },
};

/** Copy de respaldo para un `email_action_type` que Supabase agregue después. */
export const FALLBACK_COPY: EmailCopy = {
  subject: "Notificación de tu cuenta · UTEC Horarios",
  heading: "Notificación de tu cuenta",
  intro: "Hay una acción pendiente en tu cuenta de UTEC Horarios.",
  cta: "Continuar",
  note: IGNORAR,
};
