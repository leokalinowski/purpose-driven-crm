/**
 * WeekHintBar — single source of truth for the "this week's rotation letters"
 * banner. Used by PrioritiesTab so it doesn't duplicate the inline rotation
 * UI that CadenceTab uses (which has its own week-picker complexity).
 *
 * Pass a specific `weekNumber` to render a different week (e.g. last week's
 * rotation in a history view). Omit to default to the current ISO week.
 */
import { Info } from 'lucide-react';
import {
  getCurrentWeekNumber,
  getCallCategoriesForWeek,
  getTextCategoryForWeek,
} from '@/utils/sphereSyncLogic';

interface WeekHintBarProps {
  weekNumber?: number;
}

export function WeekHintBar({ weekNumber }: WeekHintBarProps = {}) {
  const weekNum = weekNumber ?? getCurrentWeekNumber();
  const callLetters = getCallCategoriesForWeek(weekNum);
  const textLetter = getTextCategoryForWeek(weekNum);
  const allLetters = [...callLetters, textLetter].filter(Boolean);

  if (allLetters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 mb-5 text-sm">
      <Info className="h-4 w-4 text-primary shrink-0" />
      <span className="text-foreground flex-1 min-w-0 leading-[1.5]">
        <span className="font-semibold">Week {weekNum}</span>
        {' '}rotates contacts with last names starting{' '}
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
        <span className="block text-[11.5px] text-muted-foreground mt-0.5">
          REOP rotates the alphabet over the year so every sphere contact gets a call twice.
        </span>
      </span>
      <div className="flex gap-1.5 shrink-0 flex-wrap">
        {allLetters.map((letter) => (
          <div
            key={letter}
            className={
              letter === textLetter
                ? 'flex h-[26px] w-[26px] items-center justify-center rounded-md bg-reop-green text-white text-[13px] font-bold border border-reop-green'
                : 'flex h-[26px] w-[26px] items-center justify-center rounded-md border border-primary/30 bg-card text-primary text-[13px] font-bold'
            }
          >
            {letter}
          </div>
        ))}
      </div>
    </div>
  );
}
