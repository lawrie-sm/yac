import { getChat } from "./chat.ts";

async function main() {
  const chat = getChat({
    model: "gpt-3.5-turbo",
    initialMessages: [
      {
        role: "system",
        content: "Repeat the text supplied by the user exactly",
      },
    ],
    stream: true,
    temperature: 0.5,
  });

  while (true) {
    try {
      const input = prompt(">") ?? "";
      if (input === "exit" || input === "quit" || input === "q") {
        break;
      }
      const response = await chat(input).next();
      console.log(response.value.message);
    } catch (e) {
      console.error(e);
      break;
    }
  }
}

if (import.meta.main) {
  main();
}
