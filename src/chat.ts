import { config } from "dotenv";

const textDecoder = new TextDecoder();

const chatUrl = "https://api.openai.com/v1/chat/completions";

const openAIAPIKey = config().OPENAI_API_KEY || Deno.env.get("OPENAI_API_KEY");
const openAIAOrgID = config().OPENAI_ORG_ID || Deno.env.get("OPENAI_ORG_ID");

const chatReqHeaders = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${openAIAPIKey}`,
  "OpenAI-Organization": `${openAIAOrgID}`,
};

type Models = "gpt-4" | "gpt-4-32k" | "gpt-3.5-turbo";

type FinishReasons = "stop" | "length" | "content_filter" | "null";

export type MessageRoles = "system" | "user" | "assistant";

interface Message {
  role: MessageRoles;
  content: string;
}

interface ChatReqBody {
  model: Models;
  messages: {
    role: MessageRoles;
    content: string;
  }[];
  temperature?: number; // How much to randomize the choices (use this or top_p)
  top_p?: number; // The cumulative probability threshold for top-p sampling
  n?: number; // How many chat completion choices to generate
  stream?: boolean; // Whether to stream the response
  stop?: string[]; // A list of tokens that will cause the chat completion to stop
  max_tokens?: number; // The maximum number of tokens to generate
  presence_penalty?: number; // How much to penalize new tokens based on whether they appear in the text so far
  frequency_penalty?: number; // How much to penalize new tokens based on their existing frequency in the text so far
  logit_bias?: { [key: string]: number }; // A dictionary of token to bias
  user?: string; // The user ID to use for this chat completion
}

interface ChatChoice {
  message: {
    role: MessageRoles;
    content: string;
  };
  finish_reason: FinishReasons;
  index: number;
}

interface ChatResBody {
  id: string;
  object: "chat.completion";
  created: number;
  model: Models;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  choices: ChatChoice[];
}

interface StreamChunkChoice {
  delta: {
    role?: MessageRoles;
    content?: string;
  };
  finish_reason: FinishReasons;
  index: number;
}

export interface StreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: Models;
  choices: StreamChunkChoice[];
}

interface GetChatIteratorArgs extends Omit<initChatArgs, "initialMessages"> {
  messages: Message[];
}

function getChatIterator(args: GetChatIteratorArgs) {
  const { messages, model, temperature, stop } = args;

  return async function* chat(prompt: string, role: MessageRoles = "user") {
    while (true) {
      messages.push({ role, content: prompt });

      const chatReqBody: ChatReqBody = {
        model,
        messages,
        temperature,
        ...(stop && { stop }),
      };

      const rawChatResponse = await fetch(chatUrl, {
        method: "POST",
        headers: chatReqHeaders,
        body: JSON.stringify(chatReqBody),
      });

      const content: ChatResBody = await rawChatResponse.json();

      const assistantMessage = content.choices[0].message;
      messages.push(assistantMessage);

      yield content;
    }
  };
}

function parseStreamDataEvents(dataValue: Uint8Array) {
  const chunkDataString = textDecoder.decode(dataValue, { stream: true });
  const dataEvents = chunkDataString.split("\n\n").filter((e) => e && e.length);

  const streamChunks = [];
  for (const eventString of dataEvents) {
    if (eventString.match(/\[DONE\]/g)) {
      break;
    }
    const jsonString = eventString.match(/^data:\s+(.*)/)![1];
    const parsedChunk = JSON.parse(jsonString) as StreamChunk;
    streamChunks.push(parsedChunk);
  }

  return streamChunks;
}

interface GetStreamingChatIteratorArgs extends GetChatIteratorArgs {
  onChunk: (chunk: StreamChunk, role: MessageRoles) => void;
}

interface StreamedChatArgs {
  prompt: string;
  role?: MessageRoles;
  onChunk?: (chunk: StreamChunk) => void;
}

function getStreamingChatIterator(args: GetStreamingChatIteratorArgs) {
  const { messages, model, temperature, stop, onChunk } = args;

  return async function* streamedChat(args: StreamedChatArgs) {
    const { prompt, role = "user" } = args;
    while (true) {
      messages.push({ role, content: prompt });

      const chatReqBody: ChatReqBody = {
        model,
        messages,
        temperature,
        stream: true,
        ...(stop && { stop }),
      };

      const rawChatResponse = await fetch(chatUrl, {
        method: "POST",
        headers: chatReqHeaders,
        body: JSON.stringify(chatReqBody),
      });

      const reader = rawChatResponse.body!.getReader();
      let partialData = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        const parsedChunks = parseStreamDataEvents(value);

        for (const chunk of parsedChunks) {
          const chunkMessage = chunk?.choices[0].delta.content;
          if (chunkMessage && chunkMessage.length) {
            partialData += chunkMessage;
          }
          onChunk && onChunk(chunk, role);
        }
      }

      const gatheredMessage = {
        role: "assistant" as MessageRoles,
        content: partialData,
      };

      console.log({ messages });
      messages.push(gatheredMessage);
      yield { message: gatheredMessage };
    }
  };
}

// TODO: This probably works better as a class
/*
 * Init with config, model, temperature, stop etc.
 * Can call method with prompt and role - streaming can have an onChunk handler still
 * Messages as a property etc.
 * We can probably halt printing when "PAUSE" occers - even if it tries to guess.
 * We can remove the guess from message history too
 */

interface initChatArgs {
  model: Models;
  initialMessages: Message[];
  temperature: number;
  stop?: string[];
}

export function initChat(args: initChatArgs) {
  const { model, initialMessages, temperature, stop } = args;
  const messages: Message[] = [...initialMessages];
  const getChatIteratorArgs = { model, messages, temperature, stop };
  return getChatIterator(getChatIteratorArgs);
}

interface initStreamingChatArgs extends initChatArgs {
  onChunk: (chunk: StreamChunk, role: MessageRoles) => void;
}

export function initStreamingChat(args: initStreamingChatArgs) {
  const { model, initialMessages, temperature, stop, onChunk } = args;
  const messages: Message[] = [...initialMessages];
  const getChatIteratorArgs = { model, messages, temperature, stop, onChunk };
  return getStreamingChatIterator(getChatIteratorArgs);
}
