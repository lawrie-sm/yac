import { parse } from "flags";
import { initStreamingChat, Message, Models, StreamChunk } from "./chat.ts";
import { isSpinnerRunning, startSpinner, stopSpinner } from "./spinner.ts";

function getChunkHandler() {
  const textEncoder = new TextEncoder();
  return function (chunk: StreamChunk) {
    isSpinnerRunning && stopSpinner();
    const chunkMessage = chunk?.choices[0].delta.content || "";
    if (chunk && chunkMessage && chunkMessage.length) {
      Deno.stdout.write(textEncoder.encode(chunkMessage));
    }
  };
}

async function main() {
  const flags = parse(Deno.args, {
    string: ["g", "t"],
    default: { g: 3 },
  });

  const model: Models = flags.g === "4" ? "gpt-4" : "gpt-3.5-turbo";
  const temperature = parseFloat(flags.t ?? "0.5");
  const initialMessages: Message[] = [
    {
      role: "system",
      content: "You are a helpful chat assistant.",
    },
  ];

  const streamingChat = initStreamingChat({
    model,
    temperature,
    initialMessages,
    onChunk: getChunkHandler(),
  });

  while (true) {
    try {
      const input = prompt("Prompt:");

      if (!input || input === "") {
        continue;
      }

      if (input === "exit" || input === "quit" || input === "\\q") {
        break;
      }

      startSpinner();
      await streamingChat({ prompt: input }).next();

      console.log();
    } catch (e) {
      console.error(e);
      continue;
    }
  }
}

if (import.meta.main) {
  main();
}
