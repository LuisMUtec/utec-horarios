'use client';

import { BLOCK_PAD } from '@/lib/schedule-utils';

interface Props {
  top: number;
  height: number;
  label: string;
}

export default function FreeBlock({ top, height, label }: Props) {
  return (
    <div
      aria-hidden="true"
      className="free-block absolute rounded-md border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center pointer-events-none select-none transition-colors duration-300"
      style={{
        // Sin altura mínima, a diferencia de CalendarBlock: un bloque libre ocupa
        // exactamente su franja o dejaría de alinearse con las clases vecinas.
        top,
        height,
        left: BLOCK_PAD,
        width: `calc(100% - ${BLOCK_PAD * 2}px)`,
      }}
    >
      <span className="text-[9px] leading-tight text-gray-400 dark:text-gray-500 px-1 truncate">
        bloque libre {label}
      </span>
    </div>
  );
}
