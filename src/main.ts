import { parse } from "flags";
import { initStreamingChat, StreamChunk } from "./chat.ts";
import { isSpinnerRunning, startSpinner, stopSpinner } from "./spinner.ts";

const textEncoder = new TextEncoder();

function onChunk(chunk: StreamChunk) {
  isSpinnerRunning && stopSpinner();
  const chunkMessage = chunk?.choices[0].delta.content || "";
  if (chunk && chunkMessage && chunkMessage.length) {
    Deno.stdout.write(textEncoder.encode(chunkMessage));
  }
}

async function main() {
  const flags = parse(Deno.args, {
    string: ["g", "t"],
    default: { g: 3 },
  });
  const model = flags.g === "3" ? "gpt-3.5-turbo" : "gpt-4";
  const temperature = parseFloat(flags.t ?? "0.5");

  const streamingChat = initStreamingChat({
    model,
    temperature: temperature,
    initialMessages: [
      {
        role: "system",
        content: "You are a helpful chat assistant.",
      },
    ],
    onChunk,
  });

  console.log(`Running ${model} with temperature ${temperature}`);

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
