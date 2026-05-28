import { requestUrl } from "obsidian";
import { CompleteRequest, LLMProvider } from "./LLMProvider";

type HttpRequest = {
  url: string;
  options: {
    method: string;
    headers: Record<string, string>;
    body: string;
  };
};

type HttpResponse = { status: number; text: string };
type HttpClient = (request: HttpRequest) => Promise<HttpResponse>;
const DEFAULT_OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export class OpenAIProvider implements LLMProvider {
  constructor(private readonly httpClient: HttpClient = defaultHttpClient) {}

  async complete(request: CompleteRequest): Promise<string> {
    const response = await this.httpClient({
      url: request.apiUrl || DEFAULT_OPENAI_API_URL,
      options: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${request.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: request.model,
          messages: [
            { role: "system", content: "You are a careful Auto LLM Wiki maintainer. Return strict JSON only." },
            { role: "user", content: request.prompt }
          ],
          temperature: 0.2
        })
      }
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`OpenAI request failed: ${response.status} ${response.text}`);
    }

    const parsed = parseOpenAIResponse(response.text);
    const content = parsed.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI response did not include message content");
    return content;
  }
}

function parseOpenAIResponse(text: string): { choices?: Array<{ message?: { content?: string } }> } {
  try {
    return JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
  } catch (error) {
    throw new Error("OpenAI response was not JSON. Check the API URL; it should point to a chat completions endpoint.");
  }
}

async function defaultHttpClient(request: HttpRequest): Promise<HttpResponse> {
  return requestUrl({
    url: request.url,
    method: request.options.method,
    headers: request.options.headers,
    body: request.options.body
  });
}
