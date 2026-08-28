import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  decimals?: number;
  className?: string;
}

/** Smoothly tweens the displayed number toward `value` whenever it changes. */
export function AnimatedNumber({ value, prefix = '', decimals = 2, className }: AnimatedNumberProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const displayedRef = useRef({ val: 0 });

  useEffect(() => {
    const target = displayedRef.current;
    const tween = gsap.to(target, {
      val: value,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => {
        if (spanRef.current) {
          spanRef.current.textContent =
            prefix + target.val.toLocaleString(undefined, {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            });
        }
      },
    });
    return () => {
      tween.kill();
    };
  }, [value, prefix, decimals]);

  return <span ref={spanRef} className={className} />;
}
