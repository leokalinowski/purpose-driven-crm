import { Info } from 'lucide-react';
import { getCurrentWeekNumber, getCallCategoriesForWeek, getTextCategoryForWeek } from '@/utils/sphereSyncLogic';

export function WeekHintBar() {
  const weekNum = getCurrentWeekNumber();
  const callLetters = getCallCategoriesForWeek(weekNum);
  const textLetter = getTextCategoryForWeek(weekNum);
  const allLetters = [...callLetters, textLetter].filter(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 mb-5 text-sm">
      <Info className="h-4 w-4 text-primary shrink-0" />
      <span className="text-foreground flex-1 min-w-0">
        <span className="font-semibold">Week {weekNum}</span>
        {' '}rotates contacts starting with letters{' '}
        {callLetters.map((l, i) => (
          <span key={l}>
            <strong className="text-primary">{l}</strong>
            {i < callLetters.length - 1 ? ', ' : ''}
          </span>
        ))}
        {textLetter && (
          <>
            {' '}(calls); texts go to{' '}
            <strong className="text-primary">{textLetter}</strong>
          </>
        )}
        .
      </span>
      <div className="flex gap-1.5 shrink-0 flex-wrap">
        {allLetters.map((letter) => (
          <div
            key={letter}
            className={
              letter === textLetter
                ? 'flex h-6 w-6 items-center justify-center rounded-md bg-reop-green text-white text-[12px] font-bold'
                : 'flex h-6 w-6 items-center justify-center rounded-md border border-primary/30 bg-white text-primary text-[12px] font-bold'
            }
          >
            {letter}
          </div>
        ))}
      </div>
    </div>
  );
}
