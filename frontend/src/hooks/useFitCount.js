import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export default function useFitCount(itemSelector, itemsKey) {
  const containerRef = useRef(null);
  const [count, setCount] = useState(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const height = container?.clientHeight ?? 0;
    const itemHeight = container?.querySelector(itemSelector)?.getBoundingClientRect().height ?? 0;

    if (!height || !itemHeight) {
      return;
    }

    const fit = Math.max(1, Math.floor(height / itemHeight));
    setCount((current) => (current === fit ? current : fit));
  }, [itemSelector]);

  useLayoutEffect(() => {
    measure();
  }, [measure, itemsKey]);

  useLayoutEffect(() => {
    const container = containerRef.current;

    if (typeof ResizeObserver === 'undefined' || !container) {
      return undefined;
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    return () => observer.disconnect();
  }, [measure]);

  return { containerRef, count };
}
