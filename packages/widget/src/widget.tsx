import { render } from "preact";
import { Draggable } from "@/components/draggable";
import {
  hasUnseenFailuresSignal,
  widgetDimensionsSignal,
  widgetDockedSignal,
  widgetExpandedSignal,
  widgetPositionSignal,
} from "@/state";
import Popover from "@/components/popover/popover";
import { useSyncTCCStore } from "@/hooks/useSyncTCCStore";
import { Logo } from "./assets/logo";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-preact";
import { cn } from "./utils/cn";

export function Widget() {
  useSyncTCCStore();

  return (
    <>
      <Draggable
        snapToCorner
        onClick={() => {
          // if we're opening the widget, mark failures as "seen"
          if (!widgetExpandedSignal.value) {
            hasUnseenFailuresSignal.value = false;
          }
          widgetExpandedSignal.value = !widgetExpandedSignal.value;
        }}
        positionSignal={widgetPositionSignal}
        dimensionsSignal={widgetDimensionsSignal}
      >
        {widgetDockedSignal.value === null ? (
          <Logo fill={hasUnseenFailuresSignal.value ? "#fff" : undefined} />
        ) : (
          <div
            className={cn(
              "text-gray-500 text-xs",
              hasUnseenFailuresSignal.value && "text-white"
            )}
          >
            {widgetDockedSignal.value === "left" && (
              <ChevronRight className="w-4 h-4" />
            )}
            {widgetDockedSignal.value === "right" && (
              <ChevronLeft className="w-4 h-4" />
            )}
            {widgetDockedSignal.value === "top" && (
              <ChevronDown className="w-4 h-4" />
            )}
            {widgetDockedSignal.value === "bottom" && (
              <ChevronUp className="w-4 h-4" />
            )}
          </div>
        )}
      </Draggable>
      {widgetExpandedSignal.value && <Popover />}
    </>
  );
}

export function createWidget(root: ShadowRoot): HTMLElement {
  const container = document.createElement("div");
  container.id = "tcc-widget-root";
  root.appendChild(container);

  render(<Widget />, container);

  return container;
}
