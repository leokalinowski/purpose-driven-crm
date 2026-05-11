/**
 * Shared react-dnd backend config — HTML5 for desktop, Touch for mobile.
 *
 * `react-dnd-html5-backend` does not fire on touch devices. Without a touch
 * backend, the Pipeline kanban + the Newsletter block builder are completely
 * unusable on a phone. `react-dnd-multi-backend` swaps backends based on the
 * detected input type (pointer-coarse → touch).
 *
 * Phase 3 of the comprehensive Pipeline fix sweep — also benefits the
 * Newsletter builder which had the same touch-dead bug.
 */

import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import type { MultiBackendOptions } from 'react-dnd-multi-backend';

export const HTML5toTouch: MultiBackendOptions = {
  backends: [
    {
      id: 'html5',
      backend: HTML5Backend,
      transition: undefined,
    },
    {
      id: 'touch',
      backend: TouchBackend,
      // Match touch on coarse pointers OR small viewports.
      preview: true,
      // Idle delay before drag fires — keeps tap-to-open-drawer responsive
      // (drag only kicks in after a deliberate hold).
      options: { enableMouseEvents: false, delayTouchStart: 150 },
      transition: {
        name: 'pointer',
        check: (event) =>
          (event as PointerEvent).pointerType === 'touch' ||
          // Fallback for browsers without pointer events (older mobile Safari).
          'touches' in (event as TouchEvent),
        eventNames: ['pointerdown', 'touchstart'],
      },
    },
  ],
};
