import Together from "together-ai";
import { ZodSchema } from "zod";

export type LLMTask = "relevance_filter" | "profile_generation" | "thesis_fit";

// const MODEL_ROUTING: Record<LLMTask, string> = {
//   relevance_filter: "deepseek-ai/DeepSeek-V3",
//   profile_generation: "deepseek-ai/DeepSeek-V3",
//   thesis_fit: "deepseek-ai/DeepSeek-V3",
// };

const MODEL_ROUTING: Record<LLMTask, string> = {
  relevance_filter: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  profile_generation: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  thesis_fit: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
};

export const PROMPT_VERSION = "v1";

const together = new Together({ apiKey: process.env.TOGETHER_API_KEY });

export interface LLMCallResult<T> {
  data: T;
  meta: { model: string; fallback: boolean };
}

type Message = { role: "system" | "user" | "assistant"; content: string };

export async function callLLM<T>(
  task: LLMTask,
  systemPrompt: string,
  userPrompt: string,
  schema: ZodSchema<T>,
  options?: { temperature?: number; buildFallback?: () => T }
): Promise<LLMCallResult<T>> {
  const model = MODEL_ROUTING[task];
  const temperature = options?.temperature ?? 0.2;
  const makeFallback = (): LLMCallResult<T> => ({
    data: options?.buildFallback?.() as T,
    meta: { model, fallback: true },
  });

  const baseMessages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  async function callAPI(messages: Message[]): Promise<string> {
    const response = await together.chat.completions.create({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature,
    });
    return response.choices[0]?.message?.content ?? "{}";
  }

  let firstContent: string;
  try {
    firstContent = await callAPI(baseMessages);
  } catch (err) {
    console.error(`[${task}] LLM API error:`, err);
    return makeFallback();
  }

  try {
    const data = schema.parse(JSON.parse(firstContent));
    return { data, meta: { model, fallback: false } };
  } catch (firstErr) {
    console.error(`[${task}] Schema validation failed on first attempt, retrying:`, firstErr);
  }

  const retryMessages: Message[] = [
    ...baseMessages,
    { role: "assistant", content: firstContent },
    {
      role: "user",
      content:
        "Your previous response did not match the required schema. Respond again with valid JSON only — no markdown, no preamble — matching the schema exactly.",
    },
  ];

  let retryContent: string;
  try {
    retryContent = await callAPI(retryMessages);
  } catch (err) {
    console.error(`[${task}] LLM API error on retry:`, err);
    return makeFallback();
  }

  try {
    const data = schema.parse(JSON.parse(retryContent));
    return { data, meta: { model, fallback: false } };
  } catch (retryErr) {
    console.error(`[${task}] Schema validation failed on retry:`, retryErr);
    return makeFallback();
  }
}
