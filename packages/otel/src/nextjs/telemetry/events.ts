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

type WidgetDockEvent = {
  event: "widget_dock_event";
  action: "dock" | "undock";
};

type WidgetResizeEvent = {
  event: "widget_resize_event";
  width: number;
  height: number;
};

type WidgetMoveEvent = {
  event: "widget_move_event";
  x: number;
  y: number;
};

type WidgetExpandEvent = {
  event: "widget_expand_event";
  expanded: boolean;
};

export type TCCAnonymousTelemetryEvent =
  | LocalModeStartEvent
  | AgentRunEndEvent
  | StepEndEvent
  | ToolCallEndEvent
  | WidgetDockEvent
  | WidgetResizeEvent
  | WidgetMoveEvent
  | WidgetExpandEvent;
