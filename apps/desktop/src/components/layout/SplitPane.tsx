import { useState, useCallback, useRef, useEffect } from "react";

interface SplitPaneProps {
  top: React.ReactNode;
  bottom: React.ReactNode;
  initialRatio?: number;
  minTopHeight?: number;
  minBottomHeight?: number;
  onRatioChange?: (ratio: number) => void;
}

export function SplitPane({
  top,
  bottom,
  initialRatio = 0.5,
  minTopHeight = 120,
  minBottomHeight = 120,
  onRatioChange,
}: SplitPaneProps) {
  const [ratio, setRatio] = useState(initialRatio);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleTouchStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onRatioChange?.(ratio);
    }
  }, [isDragging, ratio, onRatioChange]);

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onRatioChange?.(ratio);
    }
  }, [isDragging, ratio, onRatioChange]);

  const handleMove = useCallback(
    (clientY: number) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = clientY - rect.top;
      const containerHeight = rect.height;
      const newRatio = Math.max(
        minTopHeight / containerHeight,
        Math.min(1 - minBottomHeight / containerHeight, y / containerHeight),
      );
      setRatio(newRatio);
    },
    [isDragging, minTopHeight, minBottomHeight],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => { handleMove(e.clientY); },
    [handleMove],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => { if (e.touches[0]) handleMove(e.touches[0].clientY); },
    [handleMove],
  );

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handleTouchEnd);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const handleDoubleClick = () => {
    setRatio(0.5);
    onRatioChange?.(0.5);
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full">
      <div style={{ height: `${ratio * 100}%`, minHeight: `${minTopHeight}px` }} className="overflow-hidden flex flex-col shrink-0">{top}</div>
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleClick}
        className={`h-1 cursor-row-resize transition-colors flex-shrink-0 ${
          isDragging ? "bg-brand" : "bg-border-muted hover:bg-brand"
        }`}
      />
      <div style={{ height: `${(1 - ratio) * 100}%`, minHeight: `${minBottomHeight}px` }} className="overflow-hidden flex flex-col shrink-0">{bottom}</div>
    </div>
  );
}
