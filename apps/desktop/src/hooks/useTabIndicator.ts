import { useRef, useState, useEffect, type MutableRefObject } from "react";

interface IndicatorStyle {
  left: number;
  width: number;
}

export function useTabIndicator<T extends string>(
  activeTab: T,
): [MutableRefObject<Partial<Record<T, HTMLButtonElement | null>>>, IndicatorStyle] {
  const tabRefs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<IndicatorStyle>({ left: 0, width: 0 });

  useEffect(() => {
    const updateIndicator = () => {
      const el = tabRefs.current[activeTab];
      if (!el) return;
      const parent = el.parentElement;
      if (!parent) return;
      const parentRect = parent.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicatorStyle({
        left: elRect.left - parentRect.left,
        width: elRect.width,
      });
    };

    updateIndicator();

    const observer = new ResizeObserver(updateIndicator);
    const parent = tabRefs.current[activeTab]?.parentElement;
    if (parent) observer.observe(parent);
    return () => observer.disconnect();
  }, [activeTab]);

  return [tabRefs, indicatorStyle];
}