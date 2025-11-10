"use client";

import { cn } from "@/utils/cn";
import Copyable from "./copyable";
import { defaultStyles, JsonView as ReactJsonView } from "react-json-view-lite";
import { useSignal } from "@preact/signals";
import { ChevronDown } from "lucide-preact";
import Dropdown from "./dropdown";
import Markdown from "markdown-to-jsx";

function isAttributeJson(attribute: string) {
  try {
    const mabyeJson = JSON.parse(attribute);
    if (mabyeJson && typeof mabyeJson === "object") {
      return true;
    }
    return false;
  } catch (_e) {
    return false;
  }
}

type DataBlockView = "Text" | "Markdown" | "JSON";

function DataBlock({
  label,
  content,
  className,
  showDropdown = false,
  collapsed = false,
  color,
}: {
  label?: string;
  content?: string;
  className?: string;
  showDropdown?: boolean;
  collapsed?: boolean;
  color?: string;
}) {
  const isJson = content ? isAttributeJson(content) : false;

  const viewSignal = useSignal<DataBlockView>(
    showDropdown ? (isJson ? "JSON" : "Markdown") : "JSON"
  );
  const collapsedSignal = useSignal(collapsed);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div
          onClick={() => (collapsedSignal.value = !collapsedSignal.value)}
          className="flex items-center gap-2 cursor-pointer text-gray-700 hover:text-black transition-colors w-fit"
        >
          <ChevronDown
            className={cn(
              "w-3 h-3",
              collapsedSignal.value && "-rotate-90",
              color
            )}
          />
          {label && <p className={cn("text-xs font-medium", color)}>{label}</p>}
        </div>
        {!collapsedSignal.value && showDropdown && (
          <Dropdown
            trigger={
              <div className="flex items-center gap-2 cursor-pointer text-gray-700 hover:text-black transition-colors w-fit">
                <p className="text-xs">{viewSignal.value}</p>
                <ChevronDown className="w-4 h-4" />
              </div>
            }
            items={[
              { label: "Text", onClick: () => (viewSignal.value = "Text") },
              {
                label: "Markdown",
                onClick: () => (viewSignal.value = "Markdown"),
              },
              { label: "JSON", onClick: () => (viewSignal.value = "JSON") },
            ]}
          />
        )}
      </div>
      {!collapsedSignal.value && (
        <Copyable content={content}>
          <div
            className={cn(
              "group bg-white rounded p-3 border border-gray-300 relative font-mono text-xs",
              className
            )}
          >
            {viewSignal.value === "JSON" ? (
              isJson ? (
                <ReactJsonView
                  data={JSON.parse(content ?? "{}")}
                  compactTopLevel={true}
                  style={{
                    ...defaultStyles,
                    container: "font-mono text-xs bg-transparent",
                  }}
                />
              ) : (
                <p className="text-xs font-mono text-gray-700">
                  {content ?? "No content"}
                </p>
              )
            ) : viewSignal.value === "Markdown" ? (
              <div className="text-xs w-[95%]">
                <Markdown className="prose text-xs w-full">
                  {content ?? "No content"}
                </Markdown>
              </div>
            ) : (
              <p className="text-xs font-mono text-gray-700">
                {content ?? "No content"}
              </p>
            )}
          </div>
        </Copyable>
      )}
    </div>
  );
}

export default DataBlock;
