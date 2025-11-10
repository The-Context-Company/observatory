import { EnrichedUIStep, UIToolCall } from "@/types";
import DataBlock from "@/components/data-block";

const isToolCall = (row: EnrichedUIStep | UIToolCall): row is UIToolCall => {
  return "toolName" in row;
};

export function SelectedRowDataBlocks({
  row,
}: {
  row: EnrichedUIStep | UIToolCall;
}) {
  return (
    <div className="flex flex-col gap-2">
      {row.statusCode === 2 && row.statusMessage ? (
        <DataBlock
          content={row.statusMessage}
          label="Error message"
          color="text-red-500"
        />
      ) : undefined}
      {isToolCall(row) && <ToolCallDataBlocks toolCall={row} />}
      {!isToolCall(row) && <LLMCallDataBlocks step={row} />}
      <DataBlock
        content={JSON.stringify(row.attributes)}
        label="All attributes"
      />
    </div>
  );
}

const ToolCallDataBlocks = ({ toolCall }: { toolCall: UIToolCall }) => {
  const blocks = [
    {
      label: "Tool call input",
      value: toolCall.toolArgs ?? "No input",
      isJson: true,
    },
    {
      label: "Tool call output",
      value: toolCall.toolResult ?? "No output",
      isJson: true,
    },
  ];
  return blocks.map((block) => (
    <DataBlock key={block.label} label={block.label} content={block.value} />
  ));
};

const LLMCallDataBlocks = ({ step }: { step: EnrichedUIStep }) => {
  const blocks = [
    {
      label: "Generated text",
      value: step.response || "No response",
    },
  ];
  return blocks.map((block) => (
    <DataBlock key={block.label} label={block.label} content={block.value} />
  ));
};
