import { config } from "dotenv";
import { readerFromStreamReader } from "https://deno.land/std/streams/mod.ts";

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

type MessageRoles = "system" | "user" | "assistant";

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

interface ChatChunkChoice {
  delta: {
    role?: MessageRoles;
    content?: string;
  };
  finish_reason: FinishReasons;
  index: number;
}

interface ChatStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: Models;
  choices: ChatChunkChoice[];
}

interface GetChatArgs {
  model: Models;
  initialMessages: Message[];
  temperature: number;
  stream?: boolean;
  stop?: string[];
}

interface GetChatIteratorArgs extends Omit<GetChatArgs, "initialMessages"> {
  messages: Message[];
}

interface ChatRetVal {
  resBody?: ChatResBody;
  streamChunk?: ChatStreamChunkData;
  message: string;
}

function getChatIterator(args: GetChatIteratorArgs) {
  const { messages, model, temperature, stream, stop } = args;

  return async function* chat(prompt: string): AsyncGenerator<ChatRetVal> {
    while (true) {
      messages.push({ role: "user", content: prompt });

      const chatReqBody: ChatReqBody = {
        model,
        messages,
        temperature,
        ...(stream && { stream }),
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

      yield { resBody: content, message: assistantMessage.content };
    }
  };
}

function parseRawChunk(dataValue: Uint8Array): ChatStreamChunk | undefined {
  const decoder = new TextDecoder();
  const chunkDataString = decoder.decode(
    dataValue || new Uint8Array(),
    {
      stream: true,
    },
  );
  const jsonString = chunkDataString.match(/^data:\s+(.*)/)![1];
  const chunk = jsonString ? JSON.parse(jsonString) : undefined;
  return chunk;
}

function getChatStreamIterator(args: GetChatIteratorArgs) {
  const { messages, model, temperature, stream, stop } = args;

  return async function* chat(prompt: string): AsyncGenerator<ChatRetVal> {
    while (true) {
      messages.push({ role: "user", content: prompt });

      const chatReqBody: ChatReqBody = {
        model,
        messages,
        temperature,
        ...(stream && { stream }),
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

        const chunk = parseRawChunk(value);
        if (chunk) {
          partialData += chunk.choices[0].delta.content || "";
        }
      }

      messages.push({ role: "assistant", content: partialData });

      yield {
        message: partialData,
      };
    }
  };
}

export function getChat(args: GetChatArgs) {
  const { model, initialMessages, temperature, stream, stop } = args;
  const messages: Message[] = [...initialMessages];
  const getChatIteratorArgs = { model, messages, temperature, stream, stop };
  return stream
    ? getChatStreamIterator(getChatIteratorArgs)
    : getChatIterator(getChatIteratorArgs);
}
