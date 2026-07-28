# Política de privacidad

> **BORRADOR — requiere tu revisión antes de publicarse.**
> Este documento le hace promesas a los usuarios sobre el tratamiento de sus
> datos. Todo lo que afirma sobre el comportamiento actual está verificado
> contra el código. Ya no quedan decisiones abiertas, pero **nada de esto puede
> publicarse hasta que se cumplan estas tres condiciones**:
>
> 1. **`privacidad@mail.luismaquera.dev` tiene que existir y recibir correo.**
>    Está escrito en el documento como canal para ejercer derechos: publicarlo
>    sin que funcione es peor que no ofrecer ninguno.
> 2. **La purga a los 30 días tiene que estar implementada**, no solo prometida.
>    Mientras no exista, el documento afirma un borrado que no ocurre.
> 3. **Revisión legal si te vas a apoyar en la Ley 29733 peruana.** El plazo de
>    30 días y el alcance de los derechos están puestos con criterio de producto,
>    no verificados contra la norma. Lo más expuesto: **la baja de cuenta cierra
>    el acceso pero conserva la identidad de forma indefinida.** Es una supresión
>    débil, justificada por producto y no por derecho.

---

## Qué es UTEC Horarios

Una herramienta para armar tu horario y, desde 2026, para consultar y publicar
reseñas de docentes por curso. No es un servicio oficial de UTEC.

## Qué guardamos, y por qué

### Si nunca inicias sesión

**Tu horario no sale de tu navegador.** Los cursos que seleccionas, tu tema
claro u oscuro y tus preferencias se guardan solo en tu propio navegador. Si
borras los datos del sitio, desaparecen.

Con una excepción: al desplegar un curso, tu navegador le pide a nuestro servidor
las reseñas de ese curso. Viaja el curso que miras, no la lista de los que
elegiste, y no armamos ningún perfil tuyo con eso.

Puedes ver los promedios, el porcentaje de recomendación y los conteos de los
docentes sin iniciar sesión.

### Si subes tu PDF de Carga Hábil

El archivo se envía a nuestro servidor, se lee **en memoria** para extraer los
códigos de tus cursos y tu nombre, y se descarta al terminar de responder. **No
se guarda en disco, no se almacena en ninguna base de datos y no se envía a
terceros.** El resultado vive en tu navegador mientras dure la pestaña.

### Si inicias sesión

Solo aceptamos cuentas `@utec.edu.pe` y el acceso es con Google. De Google
recibimos tu identificador de cuenta, tu correo institucional y, si Google los
entrega, tu nombre y tu foto. Pedimos únicamente los permisos mínimos
(`openid`, `email`, `profile`): no accedemos a tu correo, tu Drive ni tu
calendario.

Usamos el correo para comprobar que eres de UTEC. Queda además asociado a tu
cuenta mientras exista, y esa cuenta no se borra ni siquiera si pides la baja
—abajo está por qué—.

### Si publicas una reseña

Guardamos tu puntuación, tu respuesta a si recomendarías llevar ese curso con
ese docente, tu comentario si escribiste uno, y las fechas de publicación y de
última edición, asociados a tu cuenta.

Guardamos también tu declaración de que llevaste el curso con ese docente. No la
comprobamos contra tu matrícula ni tus notas: es lo único que respalda tu reseña,
y forma parte de lo que se revisa si alguien la reporta.

Para escribir un comentario te pedimos además tu **carrera** y tu **ciclo
actual**. Los usamos como contexto interno de moderación. No se muestran nunca.

### Si reportas una reseña

Guardamos qué reseña reportaste, el motivo y tu explicación si diste una. Tu
identidad como reportante no se le muestra a nadie, tampoco al autor de la
reseña.

## Qué es público y qué no

**Tu reseña es pública. Tu identidad no.**

Junto a un comentario cualquiera puede ver las estrellas, si recomendarías
llevar el curso con ese docente, el texto, la fecha de publicación y, si lo
editaste, una marca de `editado`.

Nunca se muestra tu nombre, tu correo, tu carrera, tu ciclo, ni ningún
identificador que permita saber que esa reseña es tuya. No existen perfiles
públicos ni páginas de autor.

Ten en cuenta algo que ninguna política puede evitar: **si escribes un detalle
que solo tú podrías saber, alguien podría deducir quién eres.** El anonimato lo
protege el sistema, pero también lo que decides contar.

## Con quién se comparte

Con nadie, para nada que no sea hacer funcionar la aplicación. No vendemos
datos, no hacemos publicidad y no cedemos información a terceros con fines
comerciales.

La aplicación se apoya en proveedores de infraestructura que procesan datos por
cuenta nuestra: **Google** (inicio de sesión), **Supabase** (base de datos y
autenticación), **Vercel** (alojamiento y analítica de uso agregada) y
**Resend** (envío de los correos de la cuenta).

## Cuánto tiempo se conserva

- **Tus reseñas**, mientras las mantengas publicadas. Si eliminas una, deja de
  contar en el promedio de inmediato.
- **Una reseña eliminada se conserva 30 días y después se borra por completo:**
  texto, puntuación, recomendación y su vínculo con tu cuenta. Durante esos 30
  días ya no la ve nadie y no cuenta en ningún promedio; solo sigue disponible
  para resolver un reporte que estuviera abierto sobre ella y para que borrar y
  volver a publicar no sirva para saltarse el límite de publicación.
- **Si pides dar de baja tu cuenta**, se eliminan todas tus reseñas con el mismo
  plazo de 30 días, y se borran tu carrera y tu ciclo. La cuenta no se borra: se
  cierra. Abajo está qué queda y por qué.

## Tus opciones

- Puedes **editar o eliminar** cualquier reseña tuya cuando quieras, desde la
  aplicación y sin pedírnoslo.
- Puedes **corregir** tu carrera y tu ciclo desde tu perfil.
- Puedes usar toda la parte pública **sin iniciar sesión**.

Para lo demás —saber qué datos tenemos tuyos, corregirlos o dar de baja tu
cuenta— escríbenos a **privacidad@mail.luismaquera.dev**. Te respondemos en un
máximo de 30 días naturales.

Ese buzón es solo para privacidad y datos. Para sugerencias o errores de la
aplicación, usa el botón de contacto de la propia app.

### Qué significa "dar de baja" acá

La baja se hace a mano, no con un botón: escríbenos desde tu correo institucional
y la procesamos.

**La baja cierra tu cuenta, no la borra.**

Desaparecen tu acceso, todas tus reseñas, tu carrera y tu ciclo.

Queda el registro de que esa cuenta existió, con su correo. A los 30 días ya no
hay ninguna reseña tuya asociada a él.

Lo conservamos por una razón: sin ese registro, alguien a quien le retiramos el
acceso podría darse de baja, registrarse otra vez con el mismo correo y empezar
de cero.

## Si se retira tu acceso

Si incumples las normas de la comunidad podemos retirarte el acceso de forma
permanente y eliminar todas tus reseñas. Te informaremos del motivo.

Esto es **la única excepción** a todo lo anterior: el motivo y la fecha de la
sanción se conservan en tu cuenta de forma indefinida, también si después pides
la baja.

Tus reseñas sí se eliminan y se purgan con el plazo normal de 30 días.

## Cambios

Cuando esta política cambie, actualizaremos la fecha del final. No enviamos
correos por cada cambio: si quieres estar al tanto, revisa esta página.

---

**Última actualización:** [pendiente de publicación]
