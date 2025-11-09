import { wsSignal } from "@/state";

// TODO: shared types for events

type WidgetExpandEvent = {
  event: "widget_expand_event";
  action: "expand" | "close";
};

type WidgetDockEvent = {
  event: "widget_dock_event";
  action: "dock" | "undock";
};

type PopoverResizeEvent = {
  event: "popover_resize_event";
  width: number;
  height: number;
};

type PopoverMoveEvent = {
  event: "popover_move_event";
  x: number;
  y: number;
};

export type TCCAnonymousTelemetryEvent =
  | WidgetDockEvent
  | WidgetExpandEvent
  | PopoverResizeEvent
  | PopoverMoveEvent;

export const captureAnonymousEvent = (event: TCCAnonymousTelemetryEvent) => {
  if (!wsSignal.value) return;
  wsSignal.value.send(JSON.stringify(event));
};
