import {
  widgetCornerSignal,
  widgetDimensionsSignal,
  widgetPositionSignal,
} from "@/state";

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export const getClosestCorner = ({ x, y }: { x: number; y: number }) => {
  const currentWidth = window.innerWidth;
  const currentHeight = window.innerHeight;

  const distances: Record<Corner, number> = {
    "top-left": Math.hypot(x, y),
    "top-right": Math.hypot(currentWidth - x, y),
    "bottom-left": Math.hypot(x, currentHeight - y),
    "bottom-right": Math.hypot(currentWidth - x, currentHeight - y),
  };

  const closest = Object.entries(distances).sort((a, b) => a[1] - b[1])[0][0];
  return closest as Corner;
};

export const SAFE_AREA_MARGIN = 16;

export const getNewCornerPosition = ({
  corner,
  elementWidth,
  elementHeight,
}: {
  corner: Corner;
  elementWidth: number;
  elementHeight: number;
}): {
  x: number;
  y: number;
} => {
  const leftBound = SAFE_AREA_MARGIN;
  const rightBound = window.innerWidth - elementWidth - SAFE_AREA_MARGIN;
  const topBound = SAFE_AREA_MARGIN;
  const bottomBound = window.innerHeight - elementHeight - SAFE_AREA_MARGIN;

  switch (corner) {
    case "top-right":
      return {
        x: rightBound,
        y: topBound,
      };
    case "bottom-right":
      return {
        x: rightBound,
        y: bottomBound,
      };
    case "bottom-left":
      return {
        x: leftBound,
        y: bottomBound,
      };
    case "top-left":
      return {
        x: leftBound,
        y: topBound,
      };
  }
};

export const getPositionFromWidget = ({
  targetWidth,
  targetHeight,
}: {
  targetWidth: number;
  targetHeight: number;
}) => {
  const { x: widgetX, y: widgetY } = widgetPositionSignal.value;
  const { width: widgetWidth, height: widgetHeight } =
    widgetDimensionsSignal.value;

  const corner = getClosestCorner({
    x: widgetX,
    y: widgetY,
  });

  let x = 0;
  let y = 0;

  switch (corner) {
    case "top-right":
      x = widgetX - targetWidth;
      y = widgetY + widgetHeight;
      break;
    case "bottom-right":
      x = widgetX - targetWidth;
      y = widgetY - targetHeight;
      break;
    case "bottom-left":
      x = widgetX + widgetWidth;
      y = widgetY - targetHeight;
      break;
    case "top-left":
      x = widgetX + widgetWidth;
      y = widgetY + widgetHeight;
      break;
  }

  return { x, y };
};

export const animateDraggableElement = (
  draggableElement: HTMLDivElement,
  x: number,
  y: number
) => {
  requestAnimationFrame(() => {
    draggableElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  });
};

export const snapToCorner = (
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
