declare module "free-chatbot" {
  type Message = { role: "user" | "assistant"; content: string };
  type ChatClient = {
    chat(input: string, options?: { model?: string; maxTokens?: number; previousMessages?: Message[] }): Promise<string>;
  };

  export function createPhindChat(): ChatClient;
  export function createDuckDuckGoChat(): ChatClient;
  export function createBlackboxChat(): ChatClient;
}
