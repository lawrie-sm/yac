import { parse } from "https://deno.land/std@0.180.0/flags/mod.ts";
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

async function readFile(path: string) {
  try {
    const text = await Deno.readTextFile(path);
    return text.trim();
  } catch (e) {
    console.error(e);
    Deno.exit(1);
  }
}

function printHelp() {
  console.log(`yac - Yet Another CLI app for ChatGPT
https://github.com/lawrie-sm/yac

USAGE:
    yac [OPTIONS]

OPTIONS:
    -g
        GPT version. Valid options are 3 (3.5-turbo, default) and 4 (gpt-4-8k).
    -t
        Temperature. Defaults to 0.5.
    -f
        Text file path. File contents will be appended to the initial prompt.
`);
}

async function main() {
  const openAIAPIKey = Deno.env.get("OPENAI_API_KEY");

  if (!openAIAPIKey || openAIAPIKey === "") {
    console.log("OPENAI_API_KEY environment variable not set.");
    Deno.exit(1);
  }

  const flags = parse(Deno.args, {
    string: ["g", "t", "f"],
    boolean: ["h", "help"],
    default: { g: "3", t: "0.5" },
  });

  if (flags.h || flags.help) {
    printHelp();
    Deno.exit(0);
  }

  const model: Models = flags.g === "4" ? "gpt-4" : "gpt-3.5-turbo";
  const temperature = parseFloat(flags.t);
  const initialMessages: Message[] = [
    {
      role: "system",
      content: "You are a helpful chat assistant.",
    },
  ];

  const streamingChat = initStreamingChat({
    openAIAPIKey,
    model,
    temperature,
    initialMessages,
    onChunk: getChunkHandler(),
  });

  let fullFileText = "";
  if (flags.f) fullFileText += await readFile(flags.f);
  let isUsingFileString = fullFileText.length > 0;

  console.log(
    `Chatting with ${model} (T:${temperature}) Type 'exit' or 'quit' to exit.`
  );

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
