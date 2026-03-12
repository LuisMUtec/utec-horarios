'use client';

import { CalendarEvent } from '@/types';

interface Props {
  event: CalendarEvent;
  top: number;
  height: number;
  hasConflict: boolean;
  isPreview?: boolean;
  column?: number;
  totalColumns?: number;
}

export default function CalendarBlock({ event, top, height, hasConflict, isPreview, column = 0, totalColumns = 1 }: Props) {
  const { session, courseCode, courseName, color } = event;

  const PAD = 2; // px padding between adjacent blocks
  const widthPct = 100 / totalColumns;
  const leftPct = column * widthPct;

  return (
    <div
      className={`absolute rounded-md border-l-3 px-1.5 py-1 overflow-hidden cursor-default group transition-colors duration-300 ${color} ${
        isPreview ? 'opacity-50 dark:opacity-40 border-dashed' : ''
      } ${
        !isPreview && hasConflict ? 'ring-2 ring-red-500 dark:ring-red-500/80 ring-offset-1 dark:ring-offset-gray-900' : ''
      }`}
      style={{
        top,
        height: Math.max(height, 20),
        left: totalColumns > 1 ? `calc(${leftPct}% + ${PAD}px)` : PAD,
        width: totalColumns > 1 ? `calc(${widthPct}% - ${PAD * 2}px)` : `calc(100% - ${PAD * 2}px)`,
      }}
      title={`${courseCode} - ${courseName}\n${session.type}\n${session.startTime} - ${session.endTime}\n${session.location}\n${session.professor}`}
    >
      <div className="text-[10px] font-bold leading-tight truncate">
        {courseName}
      </div>
      {height > 30 && (
        <div className="text-[9px] leading-tight truncate opacity-80">
          {session.startTime} - {session.endTime}
        </div>
      )}
      {height > 45 && (
        <div className="text-[9px] leading-tight truncate opacity-70">
          {session.location}
        </div>
      )}
      {height > 60 && (
        <div className="text-[9px] leading-tight truncate opacity-60">
          {session.type}
        </div>
      )}
      {hasConflict && (
        <div className="absolute top-0.5 right-0.5 text-red-600 text-[10px] font-bold" title="Cruce de horario">
          !
        </div>
      )}
    </div>
  );
}
