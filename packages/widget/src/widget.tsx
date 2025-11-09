import { render } from "preact";
import { Draggable } from "@/components/draggable";
import {
  widgetDimensionsSignal,
  widgetDockedSignal,
  widgetExpandedSignal,
  widgetPositionSignal,
} from "@/state";
import Popover from "@/components/popover/popover";
import { syncTCCStore } from "@/hooks/useSyncTCCStore";
import { Logo } from "./assets/logo";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-preact";

export function Widget() {
  syncTCCStore();

  return (
    <>
      <Draggable
        snapToCorner
        onClick={() =>
          (widgetExpandedSignal.value = !widgetExpandedSignal.value)
        }
        positionSignal={widgetPositionSignal}
        dimensionsSignal={widgetDimensionsSignal}
      >
        {widgetDockedSignal.value === null ? (
          <Logo />
        ) : (
          <div className="text-gray-500 text-xs">
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
