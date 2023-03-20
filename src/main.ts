import { parse } from "flags";
import { initStreamingChat, Message, Models, StreamChunk } from "./chat.ts";
import { isSpinnerRunning, startSpinner, stopSpinner } from "./spinner.ts";

/* TODOs:
 * Get piped input working, right now using stdin is blocking prompt - probably need to write a custom prompt
*/

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

async function readFile(path: string) {
  try {
    const text = await Deno.readTextFile(path);
    return text.trim();
  } catch (e) {
    console.error(e);
    Deno.exit(1);
  }
}

async function main() {
  const flags = parse(Deno.args, {
    string: ["g", "t", "f"],
    default: { g: 3, t: "0.5" },
  });

  const model: Models = flags.g === "4" ? "gpt-4" : "gpt-3.5-turbo";
  const temperature = parseFloat(flags.t);
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

  let fullFileText = "";
  if (flags.f) fullFileText += await readFile(flags.f);
  let isUsingFileString = fullFileText.length > 0;

  while (true) {
    try {
      const promptText = isUsingFileString
        ? `Prompt [+${flags.f} (${fullFileText.length} chars)]:`
        : "Prompt:";
      let input = prompt(promptText);

      if (isUsingFileString) {
        isUsingFileString = false;
        input = fullFileText + " " + input;
      }

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
