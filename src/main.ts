import { initStreamingChat, MessageRoles, StreamChunk } from "./chat.ts";
import { isSpinnerRunning, startSpinner, stopSpinner } from "./spinner.ts";
import { callWikipedia } from "./scraper.ts";

const systemPrompt = `
You run in a loop of THOUGHT, ACTION, PAUSE, OBSERVATION.

At the end of the loop you output an answer.

Use THOUGHT to describe your thoughts about the question you have been asked. e.g:

Question: What is the capital of France?
THOUGHT: I should look up France on Wikipedia

or 

Question: How many states are there in the US?
THOUGHT: I should look up the US on Wikipedia

etc.

Use ACTION to run one of the actions available to you - then return a newline and PAUSE.

Observation will be the result of running those actions.

Currently you have one action, WIKIPEDIA, which you can use to search Wikipedia. Use it like this:
ACTION: WIKIPEDIA: <search term>

Always look things up on Wikipedia if you have the opportunity to do so.
Even if you are confident about the answer, always check on Wikipedia.
Remember your information may not be up to date, but the information on Wikipedia will be.

Example session:

User question: What is the capital of France?

THOUGHT: I should look up France on Wikipedia
ACTION: WIKIPEDIA: France
PAUSE

Once you have issued a PAUSE. Do not output further text until called again.
The ACTION will be run and the result will be returned in OBSERVATION as an assistant message.
`;

const textEncoder = new TextEncoder();

function onChunk(chunk: StreamChunk, role: MessageRoles) {
  if (role !== "system") {
    isSpinnerRunning && stopSpinner();
    const chunkMessage = chunk?.choices[0].delta.content || "";
    if (chunk && chunkMessage && chunkMessage.length) {
      Deno.stdout.write(textEncoder.encode(chunkMessage));
    }
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
      const response = await streamingChat({ prompt: input }).next();

      const message = response.value?.message;
      if (message) {
        const match = message.content.match(/ACTION:\s*WIKIPEDIA:\s*(.+)\n/);
        if (match && match.length) {
          const query = match[1];
          startSpinner();
          const wikiResponse = await callWikipedia(query);
          stopSpinner();
          await streamingChat({
            prompt: `OBSERVATION: ${wikiResponse}\n`,
            role: "assistant",
          }).next();
        }
      }

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
