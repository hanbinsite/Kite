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

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onRatioChange?.(ratio);
    }
  }, [isDragging, ratio, onRatioChange]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const containerHeight = rect.height;
      const newRatio = Math.max(
        minTopHeight / containerHeight,
        Math.min(1 - minBottomHeight / containerHeight, y / containerHeight),
      );
      setRatio(newRatio);
    },
    [isDragging, minTopHeight, minBottomHeight],
  );

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleDoubleClick = () => {
    setRatio(0.5);
    onRatioChange?.(0.5);
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      <div style={{ height: `calc(${ratio * 100}% - 2px)`, overflow: "auto" }}>{top}</div>
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        className={`h-1 cursor-row-resize transition-colors flex-shrink-0 ${
          isDragging ? "bg-brand" : "bg-border-muted hover:bg-brand"
        }`}
      />
      <div style={{ height: `calc(${(1 - ratio) * 100}% - 2px)`, overflow: "auto" }}>{bottom}</div>
    </div>
  );
}
