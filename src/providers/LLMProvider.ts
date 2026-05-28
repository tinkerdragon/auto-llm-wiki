export interface CompleteRequest {
  apiKey: string;
  apiUrl?: string;
  model: string;
  prompt: string;
}

export interface LLMProvider {
  complete(request: CompleteRequest): Promise<string>;
}
