// Punto de entrada de Next para el código de cliente: corre antes de montar la
// app, así que la medición ya está lista cuando dispara el primer efecto.
import { initPostHog } from '@/lib/posthog/init';

initPostHog();
