import { config } from "dotenv";

type OpenAIModels = "gpt-4" | "gpt-4-32k" | "gpt-3.5-turbo";

type OpenAIRoles = "system" | "user" | "assistant";

type OpenAIFinishReasons = "stop" | "length" | "content_filter" | "null";

interface ChatRequestBody {
  model: OpenAIModels;
  messages: {
    role: OpenAIRoles;
    content: string;
  }[];
  temperature?: number; // How much to randomize the choices (use this or top_p)
  top_p?: number; // The cumulative probability threshold for top-p sampling
  n?: number; // How many chat completion choices to generate
  stream?: boolean; // Whether to stream the response
  stop?: string[]; // A list of tokens (up to 4) that will cause the chat completion to stop
  max_tokens?: number; // The maximum number of tokens to generate
  presence_penalty?: number; // How much to penalize new tokens based on whether they appear in the text so far
  frequency_penalty?: number; // How much to penalize new tokens based on their existing frequency in the text so far
  logit_bias?: { [key: string]: number }; // A dictionary of token to bias
  user?: string; // The user ID to use for this chat completion
}

// TODO: Probably want to handle error bodies too
interface ChatResponseBody {
  id: string;
  object: "chat.completion";
  created: number;
  model: OpenAIModels;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  choices: {
    message: {
      role: OpenAIRoles;
      content: string;
    };
    finish_reason: OpenAIFinishReasons;
    index: number;
  }[];
}

const main = async () => {
  const openAIAPIKey = config().OPENAI_API_KEY;

  const chatCompletionUrl = "https://api.openai.com/v1/chat/completions";
  const model = "gpt-4";
  const temperature = 0.3;
  const systemMessage = "Obey the users commands";

  const openAIHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${openAIAPIKey}`,
  };

  const openAIBody: ChatRequestBody = {
    model,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: "hello" },
    ],
    temperature,
  };

  const rawResponse = await fetch(chatCompletionUrl, {
    method: "POST",
    headers: openAIHeaders,
    body: JSON.stringify(openAIBody),
  });
  console.log(rawResponse);
  const content: ChatResponseBody = await rawResponse.json();
  console.log(content);
};

if (import.meta.main) {
  main();
}
