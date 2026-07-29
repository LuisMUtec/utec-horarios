import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Política de privacidad · UTEC Horarios',
  description: 'Qué datos guarda UTEC Horarios, para qué, cuánto tiempo y qué puedes hacer.',
};

/**
 * Contenido de specs/002-resenas-docentes/politica-privacidad.md.
 *
 * El encabezado de ese documento pone tres condiciones para publicarlo (T099):
 *
 *   1. `privacidad@mail.luismaquera.dev` tiene que existir y recibir correo. El
 *      documento lo ofrece como canal para ejercer derechos.
 *   2. La purga a los 30 días tiene que estar implementada. CUMPLIDA:
 *      `private.purge_expired_reviews()` y el job de pg_cron existen desde la
 *      migración 20260729090700.
 *   3. Revisión legal si el respaldo va a ser la Ley 29733.
 *
 * Mientras 1 y 3 sigan abiertas, la ruta responde 404: publicar el texto es
 * hacer las promesas que contiene. Cerrarlas es poner esto en `true`.
 */
const PUBLICADA = false;

const H2 = 'mt-8 text-lg font-semibold text-gray-900 dark:text-gray-100';
const H3 = 'mt-5 text-sm font-semibold text-gray-900 dark:text-gray-100';
const P = 'mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300';
const UL = 'mt-3 space-y-1.5 text-sm leading-relaxed text-gray-700 dark:text-gray-300 list-disc pl-5';

export default function PrivacidadPage() {
  if (!PUBLICADA) notFound();

  return (
    <main className="mx-auto max-w-2xl p-6 pb-16">
      <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
        ← Volver al horario
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Política de privacidad
      </h1>

      <h2 className={H2}>Qué es UTEC Horarios</h2>
      <p className={P}>
        Una herramienta para armar tu horario y, desde 2026, para consultar y publicar
        reseñas de docentes por curso. No es un servicio oficial de UTEC.
      </p>

      <h2 className={H2}>Qué guardamos, y por qué</h2>

      <h3 className={H3}>Si nunca inicias sesión</h3>
      <p className={P}>
        <strong>Tu horario no sale de tu navegador.</strong> Los cursos que seleccionas, tu
        tema claro u oscuro y tus preferencias se guardan solo en tu propio navegador. Si
        borras los datos del sitio, desaparecen.
      </p>
      <p className={P}>
        Con una excepción: al desplegar un curso, tu navegador le pide a nuestro servidor
        las reseñas de ese curso. Viaja el curso que miras, no la lista de los que
        elegiste, y no armamos ningún perfil tuyo con eso.
      </p>
      <p className={P}>
        Puedes ver los promedios, el porcentaje de recomendación y los conteos de los
        docentes sin iniciar sesión.
      </p>

      <h3 className={H3}>Si subes tu PDF de Carga Hábil</h3>
      <p className={P}>
        El archivo se envía a nuestro servidor, se lee <strong>en memoria</strong> para
        extraer los códigos de tus cursos y tu nombre, y se descarta al terminar de
        responder. <strong>No se guarda en disco, no se almacena en ninguna base de datos y
        no se envía a terceros.</strong> El resultado vive en tu navegador mientras dure la
        pestaña.
      </p>

      <h3 className={H3}>Si inicias sesión</h3>
      <p className={P}>
        Solo aceptamos cuentas <code>@utec.edu.pe</code> y el acceso es con Google. De
        Google recibimos tu identificador de cuenta, tu correo institucional y, si Google
        los entrega, tu nombre y tu foto. Pedimos únicamente los permisos mínimos (
        <code>openid</code>, <code>email</code>, <code>profile</code>): no accedemos a tu
        correo, tu Drive ni tu calendario.
      </p>
      <p className={P}>
        Usamos el correo para comprobar que eres de UTEC. Queda además asociado a tu cuenta
        mientras exista, y esa cuenta no se borra ni siquiera si pides la baja —abajo está
        por qué—.
      </p>

      <h3 className={H3}>Si publicas una reseña</h3>
      <p className={P}>
        Guardamos tu puntuación, tu respuesta a si recomendarías llevar ese curso con ese
        docente, tu comentario si escribiste uno, y las fechas de publicación y de última
        edición, asociados a tu cuenta.
      </p>
      <p className={P}>
        Guardamos también tu declaración de que llevaste el curso con ese docente. No la
        comprobamos contra tu matrícula ni tus notas: es lo único que respalda tu reseña, y
        forma parte de lo que se revisa si alguien la reporta.
      </p>
      <p className={P}>
        Para escribir un comentario te pedimos además tu <strong>carrera</strong> y tu{' '}
        <strong>ciclo actual</strong>. Los usamos como contexto interno de moderación. No se
        muestran nunca.
      </p>

      <h3 className={H3}>Si reportas una reseña</h3>
      <p className={P}>
        Guardamos qué reseña reportaste, el motivo y tu explicación si diste una. Tu
        identidad como reportante no se le muestra a nadie, tampoco al autor de la reseña.
      </p>

      <h2 className={H2}>Qué es público y qué no</h2>
      <p className={P}>
        <strong>Tu reseña es pública. Tu identidad no.</strong>
      </p>
      <p className={P}>
        Junto a un comentario cualquiera puede ver las estrellas, si recomendarías llevar el
        curso con ese docente, el texto, la fecha de publicación y, si lo editaste, una
        marca de <em>editado</em>.
      </p>
      <p className={P}>
        Nunca se muestra tu nombre, tu correo, tu carrera, tu ciclo, ni ningún identificador
        que permita saber que esa reseña es tuya. No existen perfiles públicos ni páginas de
        autor.
      </p>
      <p className={P}>
        Ten en cuenta algo que ninguna política puede evitar:{' '}
        <strong>si escribes un detalle que solo tú podrías saber, alguien podría deducir
        quién eres.</strong> El anonimato lo protege el sistema, pero también lo que decides
        contar.
      </p>

      <h2 className={H2}>Con quién se comparte</h2>
      <p className={P}>
        Con nadie, para nada que no sea hacer funcionar la aplicación. No vendemos datos, no
        hacemos publicidad y no cedemos información a terceros con fines comerciales.
      </p>
      <p className={P}>
        La aplicación se apoya en proveedores de infraestructura que procesan datos por
        cuenta nuestra: <strong>Google</strong> (inicio de sesión), <strong>Supabase</strong>{' '}
        (base de datos y autenticación), <strong>Vercel</strong> (alojamiento y analítica de
        uso agregada), <strong>PostHog</strong> (analítica de uso) y <strong>Resend</strong>{' '}
        (envío de los correos de la cuenta).
      </p>

      <h3 className={H3}>Qué mide PostHog</h3>
      <p className={P}>
        Qué pantallas se visitan y qué elementos se pulsan dentro de la aplicación, para
        saber qué vale la pena mejorar. De cada elemento que pulsas se registra también su
        texto visible, así que <strong>si pulsas sobre una reseña, su texto puede quedar
        registrado</strong>. Tu PDF de Carga Hábil no se le envía nunca.
      </p>
      <p className={P}>
        Eso no revela quién escribió esa reseña: lo que se registra es que <em>tú</em>{' '}
        pulsaste ahí, no la identidad de su autor, que la aplicación tampoco muestra.
      </p>
      <p className={P}>
        Si iniciaste sesión, esa navegación queda asociada a tu cuenta mediante su
        identificador interno, y le enviamos tu correo institucional como propiedad de esa
        cuenta. Si no iniciaste sesión, se registra de forma anónima. Al cerrar sesión el
        vínculo se corta, para que quien use el navegador después no herede tu identidad.
      </p>

      <h2 className={H2}>Cuánto tiempo se conserva</h2>
      <ul className={UL}>
        <li>
          <strong>Tus reseñas</strong>, mientras las mantengas publicadas. Si eliminas una,
          deja de contar en el promedio de inmediato.
        </li>
        <li>
          <strong>Una reseña eliminada se conserva 30 días y después se borra por
          completo:</strong> texto, puntuación, recomendación y su vínculo con tu cuenta.
          Durante esos 30 días ya no la ve nadie y no cuenta en ningún promedio; solo sigue
          disponible para resolver un reporte que estuviera abierto sobre ella y para que
          borrar y volver a publicar no sirva para saltarse el límite de publicación.
        </li>
        <li>
          <strong>Si pides dar de baja tu cuenta</strong>, se eliminan todas tus reseñas con
          el mismo plazo de 30 días, y se borran tu carrera y tu ciclo. La cuenta no se
          borra: se cierra. Abajo está qué queda y por qué.
        </li>
      </ul>

      <h2 className={H2}>Tus opciones</h2>
      <ul className={UL}>
        <li>
          Puedes <strong>editar o eliminar</strong> cualquier reseña tuya cuando quieras,
          desde la aplicación y sin pedírnoslo.
        </li>
        <li>
          Puedes <strong>corregir</strong> tu carrera y tu ciclo desde tu perfil.
        </li>
        <li>
          Puedes usar toda la parte pública <strong>sin iniciar sesión</strong>.
        </li>
      </ul>
      <p className={P}>
        Para lo demás —saber qué datos tenemos tuyos, corregirlos o dar de baja tu cuenta—
        escríbenos a <strong>privacidad@mail.luismaquera.dev</strong>. Te respondemos en un
        máximo de 30 días naturales.
      </p>
      <p className={P}>
        Ese buzón es solo para privacidad y datos. Para sugerencias o errores de la
        aplicación, usa el botón de contacto de la propia app.
      </p>

      <h3 className={H3}>Qué significa «dar de baja» acá</h3>
      <p className={P}>
        La baja se hace a mano, no con un botón: escríbenos desde tu correo institucional y
        la procesamos.
      </p>
      <p className={P}>
        <strong>La baja cierra tu cuenta, no la borra.</strong>
      </p>
      <p className={P}>Desaparecen tu acceso, todas tus reseñas, tu carrera y tu ciclo.</p>
      <p className={P}>
        Queda el registro de que esa cuenta existió, con su correo. A los 30 días ya no hay
        ninguna reseña tuya asociada a él.
      </p>
      <p className={P}>
        Lo conservamos por una razón: sin ese registro, alguien a quien le retiramos el
        acceso podría darse de baja, registrarse otra vez con el mismo correo y empezar de
        cero.
      </p>

      <h2 className={H2}>Si se retira tu acceso</h2>
      <p className={P}>
        Si incumples las{' '}
        <Link href="/normas" className="text-blue-600 dark:text-blue-400 hover:underline">
          normas de la comunidad
        </Link>{' '}
        podemos retirarte el acceso de forma permanente y eliminar todas tus reseñas. Te
        informaremos del motivo.
      </p>
      <p className={P}>
        Esto es <strong>la única excepción</strong> a todo lo anterior: el motivo y la fecha
        de la sanción se conservan en tu cuenta de forma indefinida, también si después
        pides la baja.
      </p>
      <p className={P}>
        Tus reseñas sí se eliminan y se purgan con el plazo normal de 30 días.
      </p>

      <h2 className={H2}>Cambios</h2>
      <p className={P}>
        Cuando esta política cambie, actualizaremos la fecha del final. No enviamos correos
        por cada cambio: si quieres estar al tanto, revisa esta página.
      </p>
    </main>
  );
}
