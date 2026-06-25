"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FeedbackButtons } from "@/components/feedback-buttons";

const generateSessionId = () => Math.random().toString(36).substring(2, 15);
const exampleApiToken = process.env.NEXT_PUBLIC_TCC_EXAMPLE_API_TOKEN;

interface MessageMetadata {
  runId?: string;
}

export default function Chat() {
  const [input, setInput] = useState("");

  // TCC: Generate sessionId to track this conversation across multiple requests
  const [sessionId] = useState<string>(generateSessionId());

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        headers: exampleApiToken
          ? { "x-tcc-example-token": exampleApiToken }
          : undefined,
      }),
    []
  );

  const { messages, sendMessage } = useChat({ transport });

  return (
    <div className="stretch mx-auto flex w-full max-w-md flex-col py-24">
      <div className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Weather Assistant - Try: &quot;What&apos;s the weather in Tokyo?&quot;
        or &quot;Pick a random city&quot;
      </div>

      {messages.map((message) => (
        <div key={message.id} className="mb-4 whitespace-pre-wrap">
          <div className="mb-1 font-semibold text-zinc-700 dark:text-zinc-300">
            {message.role === "user" ? "You:" : "Assistant:"}
          </div>
          <div className="text-zinc-900 dark:text-zinc-100">
            {message.parts.map((part, i): React.ReactNode => {
              if (part.type === "text") {
                return <div key={`${message.id}-${i}`}>{part.text}</div>;
              }
              return null;
            })}
          </div>
          {message.role === "assistant" &&
          message.metadata &&
          (message.metadata as MessageMetadata).runId ? (
            <FeedbackButtons
              runId={(message.metadata as MessageMetadata).runId!}
            />
          ) : null}
        </div>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage(
              { text: input },
              {
                body: {
                  sessionId, // TCC: Pass sessionId to server for telemetry
                },
              }
            );
            setInput("");
          }
        }}
      >
        <input
          className="fixed bottom-0 mb-8 w-full max-w-md rounded border border-zinc-300 p-2 shadow-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
          value={input}
          placeholder="Type your message..."
          onChange={(e) => setInput(e.currentTarget.value)}
        />
      </form>
    </div>
  );
}
