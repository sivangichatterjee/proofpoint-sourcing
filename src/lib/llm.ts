import Together from "together-ai";
import { ZodSchema } from "zod";

export type LLMTask = "relevance_filter" | "profile_generation" | "thesis_fit";

const MODEL_ROUTING: Record<LLMTask, string> = {
  relevance_filter: "deepseek-ai/DeepSeek-V3",
  profile_generation: "deepseek-ai/DeepSeek-V3",
  thesis_fit: "deepseek-ai/DeepSeek-V3",
};

export const PROMPT_VERSION = "v1";

const together = new Together({ apiKey: process.env.TOGETHER_API_KEY });

export interface LLMCallResult<T> {
  data: T;
  meta: { model: string; fallback: boolean };
}

export async function callLLM<T>(
  task: LLMTask,
  systemPrompt: string,
  userPrompt: string,
  schema: ZodSchema<T>,
  options?: { temperature?: number }
): Promise<LLMCallResult<T>> {
  const model = MODEL_ROUTING[task];
  const temperature = options?.temperature ?? 0.2;

  const response = await together.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature,
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  const validated = schema.parse(parsed);

  return { data: validated, meta: { model, fallback: false } };
}