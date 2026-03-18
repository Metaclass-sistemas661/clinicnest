import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualScrollListProps<T> {
  items: T[];
  height: string;
  estimateSize: number;
  renderItem: (item: T, index: number) => ReactNode;
  gap?: number;
  className?: string;
}

/**
 * A thin wrapper around @tanstack/react-virtual that virtualises a
 * vertical list inside a fixed-height scrollable container.
 */
export function VirtualScrollList<T>({
  items,
  height,
  estimateSize,
  renderItem,
  gap = 8,
  className,
}: VirtualScrollListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    gap,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className={className} style={{ height, overflow: "auto" }}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vRow) => (
          <div
            key={vRow.key}
            data-index={vRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${vRow.start}px)`,
            }}
          >
            {renderItem(items[vRow.index], vRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
