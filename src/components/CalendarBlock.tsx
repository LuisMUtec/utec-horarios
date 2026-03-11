'use client';

import { CalendarEvent } from '@/types';

interface Props {
  event: CalendarEvent;
  top: number;
  height: number;
  hasConflict: boolean;
  isPreview?: boolean;
}

export default function CalendarBlock({ event, top, height, hasConflict, isPreview }: Props) {
  const { session, courseCode, courseName, color } = event;

  return (
    <div
      className={`absolute left-0.5 right-0.5 rounded-md border-l-3 px-1.5 py-1 overflow-hidden cursor-default group ${color} ${
        isPreview ? 'opacity-50 border-dashed' : ''
      } ${
        !isPreview && hasConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''
      }`}
      style={{ top, height: Math.max(height, 20) }}
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
