import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { EmailCopy } from "./copy.ts";

export type AuthEmailProps = {
  copy: EmailCopy;
  /** URL de verificación ya armada. Ausente en los avisos. */
  actionUrl?: string;
  /** Código de 6 dígitos que Supabase genera junto al enlace. */
  token?: string;
  /** Enlace al pie, para volver a la app. */
  siteUrl?: string;
};

// Estilos en línea: Gmail y Outlook descartan casi todo el CSS de <style>.
const main: React.CSSProperties = {
  backgroundColor: "#f3f4f6",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "32px 12px",
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  margin: "0 auto",
  maxWidth: "480px",
  padding: "32px",
};

const brand: React.CSSProperties = {
  color: "#2563eb",
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  margin: "0 0 24px",
  textTransform: "uppercase",
};

const heading: React.CSSProperties = {
  color: "#111827",
  fontSize: "22px",
  fontWeight: 600,
  lineHeight: "1.3",
  margin: "0 0 12px",
};

const paragraph: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 24px",
};

// Botón como <a>: los <button> no se renderizan igual en clientes de correo.
const button: React.CSSProperties = {
  backgroundColor: "#2563eb",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600,
  padding: "12px 24px",
  textDecoration: "none",
};

const tokenLabel: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "13px",
  margin: "0 0 8px",
};

const tokenBox: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  color: "#111827",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "26px",
  fontWeight: 700,
  letterSpacing: "0.2em",
  margin: 0,
  padding: "12px 16px",
  textAlign: "center",
};

const fallbackLink: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "24px 0 0",
  wordBreak: "break-all",
};

const hr: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "32px 0 16px",
};

const footer: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: 0,
};

export const AuthEmail = ({
  copy,
  actionUrl,
  token,
  siteUrl,
}: AuthEmailProps) => (
  <Html lang="es">
    <Head />
    <Preview>{copy.intro}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>UTEC Horarios</Text>
        <Heading style={heading}>{copy.heading}</Heading>
        <Text style={paragraph}>{copy.intro}</Text>

        {actionUrl && copy.cta && (
          <Section style={{ margin: "0 0 24px" }}>
            <Link href={actionUrl} style={button}>
              {copy.cta}
            </Link>
          </Section>
        )}

        {copy.showToken && token && (
          <Section style={{ margin: "0 0 24px" }}>
            <Text style={tokenLabel}>
              {actionUrl
                ? "¿El botón no funciona? Usa este código:"
                : "Tu código:"}
            </Text>
            <Text style={tokenBox}>{token}</Text>
          </Section>
        )}

        {copy.note && <Text style={{ ...paragraph, ...footer }}>{copy.note}</Text>}

        {actionUrl && (
          <Text style={fallbackLink}>
            O copia esta dirección en tu navegador:
            <br />
            {actionUrl}
          </Text>
        )}

        <Hr style={hr} />
        <Text style={footer}>
          {siteUrl ? (
            <>
              <Link href={siteUrl} style={{ color: "#6b7280" }}>
                UTEC Horarios
              </Link>
              {" · "}
            </>
          ) : (
            "UTEC Horarios · "
          )}
          Este correo se envió automáticamente, no respondas a esta dirección.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default AuthEmail;
