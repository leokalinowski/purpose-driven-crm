import { useCallback } from 'react';
import confetti from 'canvas-confetti';

export const useConfetti = () => {
  const triggerConfetti = useCallback(() => {
    // Create a confetti cannon from the center of the screen
    const duration = 3000; // 3 seconds
    const animationEnd = Date.now() + duration;

    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const frame = () => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return;
      }

      // Launch confetti from the center
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors,
      });

      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors,
      });

      // Launch confetti from the top center
      confetti({
        particleCount: 3,
        angle: 90,
        spread: 60,
        origin: { x: 0.5, y: 0 },
        colors: colors,
      });

      // Launch confetti from the sides
      confetti({
        particleCount: 2,
        angle: randomInRange(45, 135),
        spread: 30,
        origin: { x: randomInRange(0.1, 0.3), y: 0.6 },
        colors: colors,
      });

      confetti({
        particleCount: 2,
        angle: randomInRange(45, 135),
        spread: 30,
        origin: { x: randomInRange(0.7, 0.9), y: 0.6 },
        colors: colors,
      });

      requestAnimationFrame(frame);
    };

    frame();
  }, []);

  const triggerCelebration = useCallback(() => {
    // Big celebration confetti
    const duration = 5000; // 5 seconds
    const animationEnd = Date.now() + duration;

    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'];

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const frame = () => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return;
      }

      // Multiple confetti bursts
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 70,
        origin: { x: 0 },
        colors: colors,
      });

      confetti({
        particleCount: 5,
        angle: 120,
        spread: 70,
        origin: { x: 1 },
        colors: colors,
      });

      // Center burst
      confetti({
        particleCount: 8,
        angle: 90,
        spread: 80,
        origin: { x: 0.5, y: 0 },
        colors: colors,
      });

      // Random bursts
      confetti({
        particleCount: 3,
        angle: randomInRange(30, 150),
        spread: 40,
        origin: { x: randomInRange(0.2, 0.8), y: randomInRange(0.3, 0.7) },
        colors: colors,
      });

      requestAnimationFrame(frame);
    };

    frame();
  }, []);

  return {
    triggerConfetti,
    triggerCelebration,
  };
};
