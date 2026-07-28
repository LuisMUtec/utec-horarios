'use client';

interface Props {
  top: number;
  height: number;
  label: string;
}

export default function GapBlock({ top, height, label }: Props) {
  const PAD = 2; // px padding, igual que en CalendarBlock

  return (
    <div
      aria-hidden="true"
      className="gap-block absolute rounded-md border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center pointer-events-none select-none transition-colors duration-300"
      style={{
        top,
        height: Math.max(height, 20),
        left: PAD,
        width: `calc(100% - ${PAD * 2}px)`,
      }}
    >
      <span className="text-[9px] leading-tight text-gray-400 dark:text-gray-500 px-1 truncate">
        hueco {label}
      </span>
    </div>
  );
}
