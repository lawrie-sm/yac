import { initStreamingChat } from "./chat.ts";

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
  const textEncoder = new TextEncoder();

  // TODO: Figure out why start of stream text is being cut off sometimes
  while (true) {
    try {
      const input = prompt(">") ?? "";
      if (input === "exit" || input === "quit" || input === "q") {
        break;
      }

      const streamedChat = await streamingChat(input).next();
      while (true) {
        const chunk = await streamedChat.value.chunkStream().next();
        if (chunk.done) {
          break;
        }
        Deno.stdout.write(textEncoder.encode(chunk.value));
      }
      console.log();
    } catch (e) {
      console.error(e);
      break;
    }
  }
}

if (import.meta.main) {
  main();
}
