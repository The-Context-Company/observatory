import { cn } from "@/utils/cn";
import { getPositionFromWidget } from "@/utils/corners";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";
import {
  widgetExpandedSignal,
  selectedTraceIdSignal,
  popoverDimensionSignal,
} from "@/state";
import RunsList from "@/components/popover/runs-list";
import ToolCallsList from "./tool-calls-list";
import FailuresList from "./failures-list";
import RunViewer from "./run-viewer/run-viewer";
import { ResizableHandles } from "./ResizableHandle";
import { X } from "lucide-preact";
import { captureAnonymousEvent } from "@/internal/events";

type Tab = "Agent runs" | "Tool calls" | "Failures";

function Popover() {
  const [activeTab, setActiveTab] = useState<Tab>("Agent runs");
  const containerRef = useRef<HTMLDivElement>(null);

  // TODO: would be nice if we can abstract this drag logic into a separate
  // component that allows us to define any child as a "DraggableTrigger"
  const handleDrag = useCallback((e: globalThis.PointerEvent) => {
    e.preventDefault();

    const draggableElement = containerRef.current;
    if (!draggableElement) return;

    const { clientX: initialMouseX, clientY: initialMouseY } = e;
    const { left: draggableElementX, top: draggableElementY } =
      draggableElement.getBoundingClientRect();

    // used to prevent user from dragging widget outside of window
    const minimumX = window.innerWidth - draggableElement.offsetWidth;
    const minimumY = window.innerHeight - draggableElement.offsetHeight;

    const handlePointerMove = (e: globalThis.PointerEvent) => {
      const { clientX: currentMouseX, clientY: currentMouseY } = e;

      requestAnimationFrame(() => {
        const changeInMouseX = currentMouseX - initialMouseX;
        const changeInMouseY = currentMouseY - initialMouseY;

        const isOutsideWindowX =
          currentMouseX < 0 || currentMouseX > window.innerWidth;
        const isOutsideWindowY =
          currentMouseY < 0 || currentMouseY > window.innerHeight;

        if (isOutsideWindowX || isOutsideWindowY) {
          handlePointerUp();
          return;
        }

        const x = Math.max(
          0,
          Math.min(draggableElementX + changeInMouseX, minimumX)
        );
        const y = Math.max(
          0,
          Math.min(draggableElementY + changeInMouseY, minimumY)
        );

        draggableElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    };

    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      const { x, y } = draggableElement.getBoundingClientRect();
      captureAnonymousEvent({ event: "popover_move_event", x, y });
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  }, []);

  useLayoutEffect(() => {
    const popover = containerRef.current;
    if (!popover) return;

    if (selectedTraceIdSignal.value) {
      popoverDimensionSignal.value = {
        width: window.innerWidth * 0.6,
        height: window.innerHeight * 0.7,
      };
    } else {
      popoverDimensionSignal.value = {
        width: 630,
        height: 400,
      };
    }

    const { x, y } = getPositionFromWidget({
      targetWidth: popover.offsetWidth,
      targetHeight: popover.offsetHeight,
    });

    popover.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, [selectedTraceIdSignal.value]);

  // animate popover to new position if it would be outside of the window
  useEffect(() => {
    const popover = containerRef.current;
    if (!popover) return;

    if (!selectedTraceIdSignal.value) {
      const { x, y } = getPositionFromWidget({
        targetWidth: 630,
        targetHeight: 400,
      });

      popoverDimensionSignal.value = {
        width: 630,
        height: 400,
      };
      popover.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      return;
    }

    // check if any part of the element will be outside of the window
    const { x: popoverX, y: popoverY } = popover.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const newWidth = window.innerWidth * 0.6;
    const newHeight = window.innerHeight * 0.7;

    const isOutsideWindowX = newWidth + popoverX > windowWidth || popoverX < 0;
    const isOutsideWindowY =
      newHeight + popoverY > windowHeight || popoverY < 0;

    let transform: string | undefined;
    if (isOutsideWindowX || isOutsideWindowY) {
      const { x, y } = getPositionFromWidget({
        targetWidth: newWidth,
        targetHeight: newHeight,
      });

      transform = `translate3d(${x}px, ${y}px, 0)`;
    }

    requestAnimationFrame(() => {
      popoverDimensionSignal.value = {
        width: newWidth,
        height: newHeight,
      };
      if (transform) popover.style.transform = transform;
    });
  }, [selectedTraceIdSignal.value]);

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className={cn(
        "fixed",
        "bg-white border border-gray-200 rounded-lg",
        "z-50 overflow-hidden",
        "flex flex-col",
        "shadow-lg",
        "animate-fade-in"
      )}
      style={{
        top: 0,
        left: 0,
        width: `${popoverDimensionSignal.value.width}px`,
        height: `${popoverDimensionSignal.value.height}px`,
      }}
    >
      {selectedTraceIdSignal.value ? (
        <RunViewer />
      ) : (
        <>
          <div
            onPointerDown={handleDrag}
            className="cursor-grab flex items-center justify-between px-4 pt-3 border-b border-gray-200"
          >
            <div className="flex gap-6">
              {(["Agent runs", "Tool calls", "Failures"] as Tab[]).map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "text-sm font-medium pb-3 transition-colors relative cursor-pointer",
                      activeTab === tab
                        ? "text-gray-900"
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {tab}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
                    )}
                  </button>
                )
              )}
            </div>
            <button
              onClick={() => {
                widgetExpandedSignal.value = false;
                captureAnonymousEvent({
                  event: "widget_expand_event",
                  action: "close",
                });
              }}
              className="text-gray-500 hover:text-gray-700 cursor-pointer pb-3"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === "Agent runs" && <RunsList />}
            {activeTab === "Tool calls" && <ToolCallsList />}
            {activeTab === "Failures" && <FailuresList />}
          </div>
        </>
      )}
      <ResizableHandles containerRef={containerRef} />
    </div>
  );
}

export default Popover;
