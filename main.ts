import { getChat } from "./src/chat.ts";

async function main() {
  const chat = getChat({
    model: "gpt-3.5-turbo",
    initialMessages: [
      {
        role: "system",
        content: "Repeat the text supplied by the user exactly",
      },
    ],
    temperature: 0.5,
    stop: ["ACT"],
  });

  while (true) {
    const input = prompt(">") ?? "";
    if (input === "exit" || input === "quit" || input === "q") {
      break;
    }

    const response = await chat(input).next();

    console.log(response.value.choices[0].message.content);
  }
}

if (import.meta.main) {
  main();
}
