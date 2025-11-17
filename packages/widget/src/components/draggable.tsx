import type { JSX } from "preact";
import { useCallback, useEffect, useLayoutEffect, useRef } from "preact/hooks";
import { cn } from "@/utils/cn";
import { getClosestCorner, getNewCornerPosition } from "@/utils/corners";
import { Signal } from "@preact/signals";
import {
  DockedMode,
  hasUnseenFailuresSignal,
  widgetCornerSignal,
  widgetDockedSignal,
  widgetPositionSignal,
} from "@/state";
import {
  DOCKED_HORIZONTAL_HEIGHT,
  DOCKED_HORIZONTAL_WIDTH,
  DOCKED_VERTICAL_HEIGHT,
  DOCKED_VERTICAL_WIDTH,
  UNDOCKED_HEIGHT,
  UNDOCKED_WIDTH,
} from "@/constants";
import { captureAnonymousEvent } from "@/internal/events";

const snapToCornerFn = (
  x: number,
  y: number,
  draggableElement: HTMLDivElement
) => {
  const closestCorner = getClosestCorner({ x, y });

  const onTransitionEnd = () => {
    draggableElement.style.transition = "none";
    draggableElement.removeEventListener("transitionend", onTransitionEnd);
  };

  draggableElement.addEventListener("transitionend", onTransitionEnd);
  draggableElement.style.transition =
    "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";

  const newCornerPosition = getNewCornerPosition({
    corner: closestCorner,
    elementWidth: draggableElement.offsetWidth,
    elementHeight: draggableElement.offsetHeight,
  });

  animateDraggableElement(
    draggableElement,
    newCornerPosition.x,
    newCornerPosition.y
  );
  widgetCornerSignal.value = closestCorner;
  widgetPositionSignal.value = {
    x: newCornerPosition.x,
    y: newCornerPosition.y,
  };
};

const animateDraggableElement = (
  draggableElement: HTMLDivElement,
  x: number,
  y: number
) => {
  requestAnimationFrame(() => {
    draggableElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  });
};

// this component is in a weird state, some of it is abstracted
// and some of it assumes we're always dragging the widget.
// TODO: choose one or the other
export function Draggable({
  snapToCorner,
  children,
  className,
  onClick,
  positionSignal,
  dimensionsSignal,
  ...props
}: {
  snapToCorner?: boolean;
  children?: JSX.Element;
  className?: string;
  onClick?: () => void;
  positionSignal: Signal<{ x: number; y: number }>;
  dimensionsSignal: Signal<{ width: number; height: number }>;
} & JSX.IntrinsicElements["div"]) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDrag = useCallback((e: globalThis.PointerEvent) => {
    e.preventDefault();

    const draggableElement = containerRef.current;
    if (!draggableElement) return;

    // if element was already being dragged, stop the animation
    if (draggableElement.style.transition) {
      draggableElement.style.transition = "none";
    }

    const { clientX: initialMouseX, clientY: initialMouseY } = e;
    const { left: draggableElementX, top: draggableElementY } =
      draggableElement.getBoundingClientRect();

    // used to prevent user from dragging widget outside of window
    const minimumX = window.innerWidth - draggableElement.offsetWidth;
    const minimumY = window.innerHeight - draggableElement.offsetHeight;

    // keep track of final position so we know which corner to snap to
    let finalX = initialMouseX;
    let finalY = initialMouseY;

    const handlePointerMove = (e: globalThis.PointerEvent) => {
      const { clientX: currentMouseX, clientY: currentMouseY } = e;

      finalX = currentMouseX;
      finalY = currentMouseY;

      requestAnimationFrame(() => {
        const changeInMouseX = currentMouseX - initialMouseX;
        const changeInMouseY = currentMouseY - initialMouseY;

        const isOutsideWindowX =
          currentMouseX <= 0 || currentMouseX >= window.innerWidth - 3;
        const isOutsideWindowY =
          currentMouseY <= 0 || currentMouseY >= window.innerHeight - 3;

        if (isOutsideWindowX || isOutsideWindowY) {
          let mode: DockedMode = "left";
          let newX = 0;
          let newY = currentMouseY;

          if (currentMouseX >= window.innerWidth - 3) {
            newX = window.innerWidth - DOCKED_VERTICAL_WIDTH;
            newY = currentMouseY;
            mode = "right";
          } else if (currentMouseY <= 0) {
            newY = 0;
            newX = currentMouseX - DOCKED_VERTICAL_WIDTH / 2;
            mode = "top";
          } else if (currentMouseY >= window.innerHeight - 3) {
            newY = window.innerHeight - DOCKED_HORIZONTAL_HEIGHT;
            newX = currentMouseX;
            mode = "bottom";
          }

          handleDock(newX, newY, mode);
          return;
        }

        if (widgetDockedSignal.value !== null) {
          captureAnonymousEvent({
            event: "widget_dock_event",
            action: "undock",
          });
        }
        widgetDockedSignal.value = null;
        dimensionsSignal.value = {
          width: UNDOCKED_WIDTH,
          height: UNDOCKED_HEIGHT,
        };

        const x = Math.max(
          0,
          Math.min(draggableElementX + changeInMouseX, minimumX)
        );
        const y = Math.max(
          0,
          Math.min(draggableElementY + changeInMouseY, minimumY)
        );

        draggableElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        positionSignal.value = { x, y };
      });
    };

    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);

      const deltaX = finalX - initialMouseX;
      const deltaY = finalY - initialMouseY;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance < 3) {
        if (widgetDockedSignal.value !== null) {
          widgetDockedSignal.value = null;
          dimensionsSignal.value = {
            width: UNDOCKED_WIDTH,
            height: UNDOCKED_HEIGHT,
          };
          // set this so that snapToCornerFn() calculates margin correctly
          draggableElement.style.width = `${UNDOCKED_WIDTH}px`;
          draggableElement.style.height = `${UNDOCKED_HEIGHT}px`;
          snapToCornerFn(finalX, finalY, draggableElement);
          captureAnonymousEvent({
            event: "widget_dock_event",
            action: "undock",
          });
        } else onClick?.();
      }

      if (snapToCorner) snapToCornerFn(finalX, finalY, draggableElement);
    };

    const handleDock = (
      newX: number,
      newY: number,
      mode: DockedMode = "left"
    ) => {
      widgetDockedSignal.value = mode;
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);

      animateDraggableElement(draggableElement, newX, newY);
      positionSignal.value = { x: newX, y: newY };
      if (mode === "left" || mode === "right") {
        dimensionsSignal.value = {
          width: DOCKED_VERTICAL_WIDTH,
          height: DOCKED_VERTICAL_HEIGHT,
        };
      } else {
        dimensionsSignal.value = {
          width: DOCKED_HORIZONTAL_WIDTH,
          height: DOCKED_HORIZONTAL_HEIGHT,
        };
      }
      captureAnonymousEvent({
        event: "widget_dock_event",
        action: "dock",
      });
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp, { once: true });
  }, []);

  useEffect(() => {
    const draggableElement = containerRef.current;
    if (!draggableElement) return;

    const handleWindowResize = () => {
      const currentCorner = getClosestCorner({
        x: draggableElement.getBoundingClientRect().left,
        y: draggableElement.getBoundingClientRect().top,
      });

      if (snapToCorner) {
        const newCornerPosition = getNewCornerPosition({
          corner: currentCorner,
          elementWidth: draggableElement.offsetWidth,
          elementHeight: draggableElement.offsetHeight,
        });

        const onTransitionEnd = () => {
          draggableElement.style.transition = "none";
          draggableElement.removeEventListener(
            "transitionend",
            onTransitionEnd
          );
        };

        draggableElement.addEventListener("transitionend", onTransitionEnd);
        draggableElement.style.transition =
          "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";

        animateDraggableElement(
          draggableElement,
          newCornerPosition.x,
          newCornerPosition.y
        );
        widgetCornerSignal.value = currentCorner;
        positionSignal.value = {
          x: newCornerPosition.x,
          y: newCornerPosition.y,
        };
      }
    };

    window.addEventListener("resize", handleWindowResize, { passive: true });

    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, []);

  useLayoutEffect(() => {
    const draggableElement = containerRef.current;
    if (!draggableElement) return;

    const { x, y } = getNewCornerPosition({
      corner: "top-right",
      elementWidth: draggableElement.offsetWidth,
      elementHeight: draggableElement.offsetHeight,
    });

    draggableElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    // populate initial signal values that Popover relies on
    positionSignal.value = { x, y };
  }, []);

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className={cn(
        "fixed z-[1000]",
        widgetDockedSignal.value === null && "rounded-full",
        widgetDockedSignal.value === "top" && "rounded-b-lg",
        widgetDockedSignal.value === "bottom" && "rounded-t-lg",
        widgetDockedSignal.value === "left" && "rounded-r-lg",
        widgetDockedSignal.value === "right" && "rounded-l-lg",
        `select-none`,
        "flex items-center justify-center",
        "border shadow-sm",
        hasUnseenFailuresSignal.value
          ? "bg-red-500 border-red-500 hover:bg-red-600 hover:border-red-600"
          : "bg-white border-gray-200 hover:bg-gray-100 hover:border-gray-300",
        "cursor-pointer",
        "touch-none",
        className
      )}
      style={{
        top: 0,
        left: 0,
        width: `${dimensionsSignal.value.width}px`,
        height: `${dimensionsSignal.value.height}px`,
      }}
      onPointerDown={handleDrag}
      {...props}
    >
      {children}
    </div>
  );
}
