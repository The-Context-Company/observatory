type LocalModeStartEvent = {
  event: "local_mode_start";
};

type AgentRunEndEvent = {
  event: "agent_run_end";
  status_code: number;
  duration_ns: number;
};

type StepEndEvent = {
  event: "step_end";
  status_code: number;
  duration_ns: number;
};

type ToolCallEndEvent = {
  event: "tool_call_end";
  status_code: number;
  duration_ns: number;
};

// below events are sent from widget via ws
type WidgetDockEvent = {
  event: "widget_dock_event";
  action: "dock" | "undock";
};

type WidgetExpandEvent = {
  event: "widget_expand_event";
  expanded: boolean;
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

type RowClickEvent = {
  event: "row_click_event";
  row_type: "agent_run" | "tool_call";
  has_failure: boolean;
};

export type TCCAnonymousTelemetryEvent =
  | LocalModeStartEvent
  | AgentRunEndEvent
  | StepEndEvent
  | ToolCallEndEvent
  | WidgetDockEvent
  | PopoverResizeEvent
  | PopoverMoveEvent
  | WidgetExpandEvent
  | RowClickEvent;
