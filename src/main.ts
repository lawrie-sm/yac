import { initStreamingChat, StreamChunk } from "./chat.ts";

const textEncoder = new TextEncoder();

function onChunk(chunk: StreamChunk) {
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
        content: "You are a helpful chat assistant",
      },
    ],
  });

  while (true) {
    try {
      const input = prompt("Prompt:") ?? "";
      if (input === "exit" || input === "quit" || input === "q") {
        break;
      }

      const streamedChat = await streamingChat(input, onChunk).next();
      // console.log({ msg: streamedChat.value.message });
    } catch (e) {
      console.error(e);
      continue;
    }
  }
}

if (import.meta.main) {
  main();
}
