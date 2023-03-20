import { initStreamingChat, StreamChunk } from "./chat.ts";
import { isSpinnerRunning, startSpinner, stopSpinner } from "./spinner.ts";

const systemPrompt = "You are a helpful chat assistant.";

const textEncoder = new TextEncoder();

function onChunk(chunk: StreamChunk) {
  isSpinnerRunning && stopSpinner();
  const chunkMessage = chunk?.choices[0].delta.content || "";
  if (chunk && chunkMessage && chunkMessage.length) {
    Deno.stdout.write(textEncoder.encode(chunkMessage));
  }
}

async function main() {
  const streamingChat = initStreamingChat({
    model: "gpt-3.5-turbo",
    temperature: 0.5,
    initialMessages: [
      {
        role: "system",
        content: systemPrompt,
      },
    ],
    onChunk,
  });

  while (true) {
    try {
      const input = prompt("Prompt:");

      if (!input || input === "") {
        continue;
      }

      if (input === "exit" || input === "quit" || input === "q") {
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
