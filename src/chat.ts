const textDecoder = new TextDecoder();

const chatUrl = "https://api.openai.com/v1/chat/completions";

export type Models = "gpt-4" | "gpt-4-32k" | "gpt-3.5-turbo";

export interface Message {
  role: MessageRoles;
  content: string;
}

type FinishReasons = "stop" | "length" | "content_filter" | "null";

type MessageRoles = "system" | "user" | "assistant";

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

interface InitStreamingChat {
  openAIAPIKey: string;
  model: Models;
  initialMessages: Message[];
  temperature: number;
  stop?: string[];
  onChunk: (chunk: StreamChunk, role: MessageRoles) => void;
}

interface GetStreamingChatIterator
  extends Omit<InitStreamingChat, "initialMessages"> {
  onChunk: (chunk: StreamChunk, role: MessageRoles) => void;
  messages: Message[];
}

interface DoStreamingChat {
  prompt: string;
  role?: MessageRoles;
  onChunk?: (chunk: StreamChunk) => void;
}

function parseStreamDataEvents(dataValue: Uint8Array) {
  const chunkDataString = textDecoder.decode(dataValue, { stream: true });
  const dataEvents = chunkDataString.split("\n\n").filter((e) => e && e.length);

  const streamChunks = [];
  for (const eventString of dataEvents) {
    if (eventString.match(/\[DONE\]/g)) {
      break;
    }
    const jsonString = eventString.match(/^data:\s+(.*)/);
    if (!jsonString || !jsonString[1]) {
      continue;
    } else {
      const parsedChunk = JSON.parse(jsonString[1]) as StreamChunk;
      streamChunks.push(parsedChunk);
    }
  }

  return streamChunks;
}

function getStreamingChatIterator(args: GetStreamingChatIterator) {
  const { openAIAPIKey, messages, model, temperature, stop, onChunk } = args;

  const chatReqHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${openAIAPIKey}`,
  };

  return async function* doStreamingChat(args: DoStreamingChat) {
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

      messages.push(gatheredMessage);
      yield { message: gatheredMessage };
    }
  };
}

export function initStreamingChat(args: InitStreamingChat) {
  const { openAIAPIKey, model, initialMessages, temperature, stop, onChunk } =
    args;

  const messages: Message[] = [...initialMessages];

  const getChatIteratorArgs = {
    openAIAPIKey,
    model,
    messages,
    temperature,
    stop,
    onChunk,
  };

  return getStreamingChatIterator(getChatIteratorArgs);
}
