# yac

Yet Another CLI app for ChatGPT.

Uses the streaming output, and supports text files as prompt inputs. Chats maintain persistent context, similar to the web app.

### Installation

Your OpenAI API key needs to be set in your environment as OPENAI_API_KEY.

Requires [Deno](https://github.com/denoland/deno).

Run directly:

```
deno run --allow-env --allow-net src/main.ts
```

Compile:

```
deno task compile-linux-x86_64
# OR
deno task compile-macos-x86_64
# OR
deno task compile-windows-x86_64
```
