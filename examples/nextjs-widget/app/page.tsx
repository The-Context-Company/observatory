"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const exampleApiToken = process.env.NEXT_PUBLIC_TCC_EXAMPLE_API_TOKEN;

export default function Chat() {
  const [input, setInput] = useState("");

  // Send the example API token so the protected /api/chat route accepts the
  // request. Omitted automatically for local-only demos that bypass the gate.
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
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map((message) => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === "user" ? "User: " : "AI: "}
          {message.parts.map((part, i) => {
            switch (part.type) {
              case "text":
                return <div key={`${message.id}-${i}`}>{part.text}</div>;
            }
          })}
        </div>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage({ text: input });
          setInput("");
        }}
      >
        <input
          className="fixed dark:bg-zinc-900 bottom-0 w-full max-w-md p-2 mb-8 border border-zinc-300 dark:border-zinc-800 rounded shadow-xl"
          value={input}
          placeholder="Say something..."
          onChange={(e) => setInput(e.currentTarget.value)}
        />
      </form>
    </div>
  );
}
