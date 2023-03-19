import { config } from "dotenv";

const openAIAPIKey = config().OPENAI_API_KEY || Deno.env.get("OPENAI_API_KEY");
const openAIAOrgID = config().OPENAI_ORG_ID || Deno.env.get("OPENAI_ORG_ID");

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

// TODO: Probably want to handle error bodies too
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
  choices: {
    message: {
      role: MessageRoles;
      content: string;
    };
    finish_reason: FinishReasons;
    index: number;
  }[];
}

interface GetChatArgs {
  model: Models;
  initialMessages: Message[];
  temperature: number;
  stop?: string[];
}

export function getChat(args: GetChatArgs) {
  const { model, initialMessages, temperature, stop } = args;
  const chatCompletionUrl = "https://api.openai.com/v1/chat/completions";

  const openAIHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${openAIAPIKey}`,
    "OpenAI-Organization": `${openAIAOrgID}`,
  };

  const messages: Message[] = [...initialMessages];

  async function* chat(prompt: string): AsyncIterator<ChatResBody> {
    while (true) {
      messages.push({ role: "user", content: prompt });

      const openAIBody: ChatReqBody = {
        model,
        messages,
        temperature,
        stop,
      };

      const rawResponse = await fetch(chatCompletionUrl, {
        method: "POST",
        headers: openAIHeaders,
        body: JSON.stringify(openAIBody),
      });

      const content: ChatResBody = await rawResponse.json();

      console.log(content.choices);

      const assistantMessage = content.choices[0].message;
      messages.push(assistantMessage);

      yield content;
    }
  }
  return chat;
}
