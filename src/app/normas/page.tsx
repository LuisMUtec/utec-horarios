import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Normas de la comunidad · UTEC Horarios',
  description:
    'Qué se puede publicar en las reseñas de docentes, qué no, cómo se reporta y qué pasa después.',
};

/**
 * Contenido de specs/002-resenas-docentes/normas-comunidad.md (FR-026). Deriva
 * de FR-041 (prohibiciones) y FR-043 (motivos de reporte); esta página es la
 * versión publicada y el documento queda como su origen.
 */

const H2 = 'mt-8 text-lg font-semibold text-gray-900 dark:text-gray-100';
const P = 'mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300';
const UL = 'mt-3 space-y-1.5 text-sm leading-relaxed text-gray-700 dark:text-gray-300 list-disc pl-5';

export default function NormasPage() {
  return (
    <main className="mx-auto max-w-2xl p-6 pb-16">
      <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
        ← Volver al horario
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Normas de la comunidad
      </h1>

      <h2 className={H2}>Para qué sirve este espacio</h2>
      <p className={P}>
        Las reseñas existen para que un estudiante que está armando su horario sepa cómo
        fue la experiencia académica de otros alumnos con un docente{' '}
        <strong>en un curso concreto</strong>. Nada más.
      </p>
      <p className={P}>
        Escribe pensando en la persona que va a leerte antes de matricularse: qué le habría
        servido saber a ti antes de llevar ese curso.
      </p>

      <h2 className={H2}>Qué sí va</h2>
      <ul className={UL}>
        <li>Cómo fue la experiencia académica con ese docente en ese curso.</li>
        <li>Cómo explicaba, cómo organizaba el curso, cómo evaluaba, cómo respondía dudas.</li>
        <li>Lo que a ti te habría gustado saber antes de matricularte.</li>
      </ul>
      <p className={P}>
        Puedes publicar solo una puntuación, sin escribir nada. También sirve.
      </p>
      <p className={P}>
        Tu reseña queda atada a ese docente en ese curso: si deja de dictarlo, deja de
        mostrarse, y vuelve a aparecer si vuelve a dictarlo.
      </p>

      <h2 className={H2}>Qué no va</h2>
      <ul className={UL}>
        <li>
          <strong>Insultos o ataques personales</strong> contra el docente o contra
          cualquiera.
        </li>
        <li>
          <strong>Acusaciones sobre la vida privada</strong> de una persona.
        </li>
        <li>
          <strong>Datos personales</strong>: teléfonos, direcciones, redes sociales, datos
          de terceros.
        </li>
        <li>
          <strong>Contenido falso o engañoso</strong>, incluida una experiencia que no
          tuviste.
        </li>
        <li>
          <strong>Spam</strong> o contenido no relacionado con el curso.
        </li>
        <li>
          <strong>Preguntas y solicitudes de información.</strong> Este espacio recoge
          experiencias pasadas; no es un canal para preguntar ni para pedir datos. Nadie te
          va a responder acá.
        </li>
        <li>
          <strong>Expresiones de interés</strong> del tipo «quiero llevar este curso» o «me
          interesa esta sección».
        </li>
        <li>
          Cualquier cosa que <strong>no describa una experiencia académica</strong> con ese
          docente en ese curso.
        </li>
      </ul>

      <h2 className={H2}>Solo si llevaste el curso</h2>
      <p className={P}>
        Antes de publicar tienes que declarar que llevaste ese curso con ese docente. No lo
        verificamos contra tu matrícula ni contra tus notas: es una declaración tuya, y el
        valor de todo esto depende de que sea cierta.
      </p>
      <p className={P}>Reseñar un curso que no llevaste incumple estas normas.</p>

      <h2 className={H2}>Tu reseña es anónima, pero no es anticonsecuencias</h2>
      <p className={P}>
        Tu nombre, tu correo, tu carrera y tu ciclo <strong>nunca</strong> se muestran junto
        a tu reseña. Que nadie te vea no significa que no haya reglas: seguimos pudiendo
        retirar una reseña y retirar el acceso de quien las incumple.
      </p>

      <h2 className={H2}>Reportar</h2>
      <p className={P}>
        Cualquier reseña con comentario tiene la acción <strong>Reportar</strong>. Al
        reportar eliges un motivo:
      </p>
      <ul className={UL}>
        <li>Insulto o ataque personal</li>
        <li>Contenido falso o engañoso</li>
        <li>Datos personales</li>
        <li>No describe una experiencia con el docente</li>
        <li>Spam o no relacionado</li>
        <li>Otro (te pedimos que expliques)</li>
      </ul>
      <p className={P}>
        Mientras revisamos, esa reseña deja de aparecerte a ti. Sigue visible para el resto
        hasta que haya una decisión: no queremos que reportar sea una forma de esconder lo
        que a uno no le gusta.
      </p>
      <p className={P}>Puedes reportar cada reseña una sola vez.</p>

      <h2 className={H2}>Qué pasa después de un reporte</h2>
      <p className={P}>Una persona lo revisa y decide una de tres cosas:</p>
      <ol className="mt-3 space-y-1.5 text-sm leading-relaxed text-gray-700 dark:text-gray-300 list-decimal pl-5">
        <li>
          <strong>Se mantiene.</strong> No incumple las normas, y sigue contando en el
          promedio.
        </li>
        <li>
          <strong>Se elimina.</strong> Deja de contar en el promedio y en los conteos, de
          inmediato. La eliminación es definitiva: ni siquiera su autor puede recuperarla.
        </li>
        <li>
          <strong>Se elimina y se retira el acceso.</strong> Para incumplimientos graves.
        </li>
      </ol>

      <h2 className={H2}>Si se te retira el acceso</h2>
      <p className={P}>
        Es permanente y afecta a tu cuenta institucional. Pierdes el acceso a leer
        comentarios, publicar, editar, eliminar y reportar, y{' '}
        <strong>se eliminan todas tus reseñas</strong>, no solo la que motivó el reporte. Te
        diremos que ocurrió y por qué motivo.
      </p>
      <p className={P}>
        Conservas lo que ve cualquier visitante: los promedios y conteos públicos.
      </p>
    </main>
  );
}
