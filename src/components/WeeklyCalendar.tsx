'use client';

import { CalendarEvent } from '@/types';
import {
  DAYS,
  DAY_LABELS,
  START_HOUR,
  END_HOUR,
  timeToMinutes,
  findConflicts,
} from '@/lib/schedule-utils';
import CalendarBlock from './CalendarBlock';

interface Props {
  events: CalendarEvent[];
  previewEvents?: CalendarEvent[];
}

const HOUR_HEIGHT = 48; // px per hour
const TOTAL_HOURS = END_HOUR - START_HOUR;

export default function WeeklyCalendar({ events, previewEvents = [] }: Props) {
  const conflicts = findConflicts(events);
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Header */}
        <div className="grid grid-cols-[60px_repeat(6,1fr)] border-b border-gray-200 dark:border-gray-800 transition-colors duration-300">
          <div className="p-2 text-xs text-gray-400 dark:text-gray-500 text-center">Hora</div>
          {DAYS.map(day => (
            <div
              key={day}
              className="p-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 border-l border-gray-200 dark:border-gray-800 transition-colors duration-300"
            >
              <span className="hidden sm:inline">{DAY_LABELS[day]}</span>
              <span className="sm:hidden">{day}</span>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="grid grid-cols-[60px_repeat(6,1fr)] relative">
          {/* Hour labels and grid lines */}
          <div className="relative">
            {hours.map(hour => (
              <div
                key={hour}
                className="border-b border-gray-100 dark:border-gray-800/50 text-xs text-gray-400 dark:text-gray-500 text-right pr-2 flex items-start justify-end transition-colors duration-300"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="-mt-2">{String(hour).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {DAYS.map(day => {
            const dayEvents = events
              .map((event, idx) => ({ event, idx }))
              .filter(({ event }) => event.session.day === day);

            return (
              <div
                key={day}
                className="relative border-l border-gray-200 dark:border-gray-800 transition-colors duration-300"
                style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
              >
                {/* Hour grid lines */}
                {hours.map(hour => (
                  <div
                    key={hour}
                    className="absolute w-full border-b border-gray-100 dark:border-gray-800/50 transition-colors duration-300"
                    style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map(({ event, idx }) => {
                  const startMin = timeToMinutes(event.session.startTime);
                  const endMin = timeToMinutes(event.session.endTime);
                  const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                  const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
                  const hasConflict = conflicts.has(`${idx}`);

                  return (
                    <CalendarBlock
                      key={`${event.courseCode}-${idx}`}
                      event={event}
                      top={top}
                      height={height}
                      hasConflict={hasConflict}
                    />
                  );
                })}

                {/* Preview Events */}
                {previewEvents
                  .filter(event => event.session.day === day)
                  .map((event, i) => {
                    const startMin = timeToMinutes(event.session.startTime);
                    const endMin = timeToMinutes(event.session.endTime);
                    const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                    const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;

                    return (
                      <CalendarBlock
                        key={`preview-${event.courseCode}-${i}`}
                        event={event}
                        top={top}
                        height={height}
                        hasConflict={false}
                        isPreview
                      />
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
