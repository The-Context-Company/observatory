import { useCallback, useRef } from "preact/hooks";
import { popoverDimensionSignal } from "@/state";
import type { CSSProperties, RefObject } from "preact";
import { captureAnonymousEvent } from "@/internal/events";

type HandlePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface ResizableHandleProps {
  position: HandlePosition;
  containerRef: RefObject<HTMLDivElement>;
}

const HANDLE_SIZE = 12;
const MIN_WIDTH = 300;
const MIN_HEIGHT = 200;

export function ResizableHandle({
  position,
  containerRef,
}: ResizableHandleProps) {
  const isResizingRef = useRef(false);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const container = containerRef.current;
      if (!container || isResizingRef.current) return;

      isResizingRef.current = true;

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = popoverDimensionSignal.value.width;
      const startHeight = popoverDimensionSignal.value.height;
      const startRect = container.getBoundingClientRect();
      const startLeft = startRect.left;
      const startTop = startRect.top;

      const handlePointerMove = (e: PointerEvent) => {
        if (!isResizingRef.current) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;

        // enforce minimum/maximu dimensions
        switch (position) {
          case "top-left":
            newWidth = Math.max(MIN_WIDTH, startWidth - deltaX);
            newHeight = Math.max(MIN_HEIGHT, startHeight - deltaY);
            newLeft = startLeft + (startWidth - newWidth);
            newTop = startTop + (startHeight - newHeight);
            break;

          case "top-right":
            newWidth = Math.max(MIN_WIDTH, startWidth + deltaX);
            newHeight = Math.max(MIN_HEIGHT, startHeight - deltaY);
            newTop = startTop + (startHeight - newHeight);
            break;

          case "bottom-left":
            newWidth = Math.max(MIN_WIDTH, startWidth - deltaX);
            newHeight = Math.max(MIN_HEIGHT, startHeight + deltaY);
            newLeft = startLeft + (startWidth - newWidth);
            break;

          case "bottom-right":
            newWidth = Math.max(MIN_WIDTH, startWidth + deltaX);
            newHeight = Math.max(MIN_HEIGHT, startHeight + deltaY);
            break;
        }

        // enforce window bounds
        if (newLeft < 0) {
          newWidth += newLeft;
          newLeft = 0;
        }
        if (newTop < 0) {
          newHeight += newTop;
          newTop = 0;
        }
        if (newLeft + newWidth > window.innerWidth) {
          newWidth = window.innerWidth - newLeft;
        }
        if (newTop + newHeight > window.innerHeight) {
          newHeight = window.innerHeight - newTop;
        }

        newWidth = Math.max(MIN_WIDTH, newWidth);
        newHeight = Math.max(MIN_HEIGHT, newHeight);

        popoverDimensionSignal.value = {
          width: newWidth,
          height: newHeight,
        };

        container.style.transform = `translate3d(${newLeft}px, ${newTop}px, 0)`;
      };

      const handlePointerUp = () => {
        isResizingRef.current = false;
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        const { width, height } = popoverDimensionSignal.value;
        captureAnonymousEvent({ event: "popover_resize_event", width, height });
      };

      const cursor =
        position === "top-left" || position === "bottom-right"
          ? "nwse-resize"
          : "nesw-resize";

      document.body.style.cursor = cursor;
      document.body.style.userSelect = "none";

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [position, containerRef]
  );

  const getHandleClassName = (): string => {
    const base = "resize-handle";
    let cursor = "";

    switch (position) {
      case "top-left":
        cursor = "cursor-nwse-resize";
        break;
      case "top-right":
        cursor = "cursor-nesw-resize";
        break;
      case "bottom-left":
        cursor = "cursor-nesw-resize";
        break;
      case "bottom-right":
        cursor = "cursor-nwse-resize";
        break;
    }

    return `${base} ${cursor}`;
  };

  const getHandleStyle = (): CSSProperties => {
    const size = `${HANDLE_SIZE}px`;

    switch (position) {
      case "top-left":
        return {
          top: 0,
          left: 0,
          width: size,
          height: size,
        };
      case "top-right":
        return {
          top: 0,
          right: 0,
          width: size,
          height: size,
        };
      case "bottom-left":
        return {
          bottom: 0,
          left: 0,
          width: size,
          height: size,
        };
      case "bottom-right":
        return {
          bottom: 0,
          right: 0,
          width: size,
          height: size,
        };
    }
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      className={getHandleClassName()}
      style={getHandleStyle()}
    />
  );
}

interface ResizableHandlesProps {
  containerRef: RefObject<HTMLDivElement>;
}

export function ResizableHandles({ containerRef }: ResizableHandlesProps) {
  return (
    <>
      <ResizableHandle position="top-left" containerRef={containerRef} />
      <ResizableHandle position="top-right" containerRef={containerRef} />
      <ResizableHandle position="bottom-left" containerRef={containerRef} />
      <ResizableHandle position="bottom-right" containerRef={containerRef} />
    </>
  );
}
