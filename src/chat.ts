import { config } from "dotenv";

const chatUrl = "https://api.openai.com/v1/chat/completions";

const openAIAPIKey = config().OPENAI_API_KEY || Deno.env.get("OPENAI_API_KEY");
const openAIAOrgID = config().OPENAI_ORG_ID || Deno.env.get("OPENAI_ORG_ID");

const decoder = new TextDecoder();

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

interface StreamChunkChoice {
  delta: {
    role?: MessageRoles;
    content?: string;
  };
  finish_reason: FinishReasons;
  index: number;
}

interface StreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: Models;
  choices: StreamChunkChoice[];
}

interface GetChatArgs {
  model: Models;
  initialMessages: Message[];
  temperature: number;
  stop?: string[];
}

interface GetChatIteratorArgs extends Omit<GetChatArgs, "initialMessages"> {
  messages: Message[];
}

function getChatIterator(args: GetChatIteratorArgs) {
  const { messages, model, temperature, stop } = args;

  return async function* chat(prompt: string) {
    while (true) {
      messages.push({ role: "user", content: prompt });

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

function parseRawChunk(dataValue: Uint8Array): StreamChunk | undefined {
  const chunkDataString = decoder.decode(
    dataValue || new Uint8Array(),
    {
      stream: true,
    },
  );

  if (
    !chunkDataString || !chunkDataString.length ||
    chunkDataString.match(/^\[DONE\]/)
  ) {
    return undefined;
  }

  const jsonString = chunkDataString.match(/^data:\s+(.*)/)![1];
  const chunk = jsonString ? JSON.parse(jsonString) : undefined;
  return chunk;
}

interface GetChunkStreamIteratorArgs {
  reader: ReadableStreamDefaultReader<Uint8Array>;
  appendMessage: (value: string) => void;
}

function getChunkStreamIterator(args: GetChunkStreamIteratorArgs) {
  const { appendMessage, reader } = args;
  return async function* chunkStream() {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      const chunk = parseRawChunk(value);
      if (!chunk) {
        break;
      }

      const chunkMessage = chunk?.choices[0].delta.content || "";
      if (chunk) {
        appendMessage(chunkMessage);
      }

      yield chunkMessage;
    }
  };
}

function getStreamingChatIterator(args: GetChatIteratorArgs) {
  const { messages, model, temperature, stop } = args;

  return async function* streamedChat(prompt: string) {
    while (true) {
      messages.push({ role: "user", content: prompt });

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
      const chunkStream = getChunkStreamIterator({
        reader,
        appendMessage: (value: string) => {
          partialData += value.trim();
        },
      });
      messages.push({ role: "assistant", content: partialData });

      yield {
        chunkStream,
        message: partialData,
      };
    }
  };
}

export function initChat(args: GetChatArgs) {
  const { model, initialMessages, temperature, stop } = args;
  const messages: Message[] = [...initialMessages];
  const getChatIteratorArgs = { model, messages, temperature, stop };
  return getChatIterator(getChatIteratorArgs);
}

export function initStreamingChat(args: GetChatArgs) {
  const { model, initialMessages, temperature, stop } = args;
  const messages: Message[] = [...initialMessages];
  const getChatIteratorArgs = { model, messages, temperature, stop };
  return getStreamingChatIterator(getChatIteratorArgs);
}
