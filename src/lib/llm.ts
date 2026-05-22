import Together from "together-ai";
import OpenAI from "openai";
import { ZodSchema } from "zod";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export type LLMTask = "relevance_filter" | "profile_generation" | "thesis_fit" | "agent_planner";

// const MODEL_ROUTING: Record<LLMTask, string> = {
//   relevance_filter: "deepseek-ai/DeepSeek-V3",
//   profile_generation: "deepseek-ai/DeepSeek-V3",
//   thesis_fit: "deepseek-ai/DeepSeek-V3",
// };

const MODEL_ROUTING: Record<LLMTask, string> = {
  relevance_filter: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  profile_generation: "deepseek-ai/DeepSeek-V4-Pro",
  thesis_fit: "deepseek-ai/DeepSeek-V4-Pro",
  agent_planner: "deepseek-ai/DeepSeek-V4-Pro",
};

type LLMProvider = "together" | "openai";

const MODEL_PROVIDER: Record<string, LLMProvider> = {
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": "together",
  "deepseek-ai/DeepSeek-V4-Pro": "together",
  "gpt-4o-mini": "openai",
};

const MODEL_FALLBACK: Partial<Record<string, string>> = {
  "deepseek-ai/DeepSeek-V4-Pro": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  "gpt-4o-mini": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
};

export const PROMPT_VERSION = "v1";

const together = new Together({ apiKey: process.env.TOGETHER_API_KEY });
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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
  options?: { temperature?: number; buildFallback?: () => T | null; modelOverride?: string }
): Promise<LLMCallResult<T>> {
  const model = options?.modelOverride ?? MODEL_ROUTING[task];
  const temperature = options?.temperature ?? 0.2;
  const makeFallback = (): LLMCallResult<T> => ({
    data: (options?.buildFallback?.() ?? null) as unknown as T,
    meta: { model, fallback: true },
  });

  const baseMessages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  async function callAPI(messages: Message[], modelToUse: string, temp: number): Promise<string> {
    const providerToUse = MODEL_PROVIDER[modelToUse] ?? "together";
    if (providerToUse === "openai") {
      if (!openaiClient) throw new Error("OpenAI client not initialized — OPENAI_API_KEY missing");
      const response = await openaiClient.chat.completions.create({
        model: modelToUse,
        messages,
        response_format: { type: "json_object" },
        temperature: temp,
        max_tokens: 1000,
      });
      return response.choices[0]?.message?.content ?? "";
    } else {
      const response = await together.chat.completions.create({
        model: modelToUse,
        messages,
        response_format: { type: "json_object" },
        temperature: temp,
      });
      return response.choices[0]?.message?.content ?? "{}";
    }
  }

  let firstContent: string;
  let activeModel = model;

  try {
    firstContent = await callAPI(baseMessages, model, temperature);
  } catch (firstCallErr: unknown) {
    const e = firstCallErr as { status?: number; message?: string };
    const is503 = e?.status === 503 || e?.message?.includes("503") || e?.message?.includes("service_unavailable");
    const fallbackModel = MODEL_FALLBACK[model];

    if (is503 && fallbackModel) {
      console.warn(`[${task}] ${model} returned 503 — waiting 2s then retrying with ${fallbackModel}`);
      await sleep(2000);
      try {
        firstContent = await callAPI(baseMessages, fallbackModel, temperature);
        activeModel = fallbackModel;
        console.log(`[${task}] Fallback to ${fallbackModel} succeeded`);
      } catch (fallbackErr) {
        console.error(`[${task}] Fallback model also failed:`, fallbackErr);
        return makeFallback();
      }
    } else {
      console.error(`[${task}] LLM API error:`, firstCallErr);
      return makeFallback();
    }
  }

  try {
    const data = schema.parse(JSON.parse(firstContent));
    return { data, meta: { model: activeModel, fallback: false } };
  } catch (firstErr) {
    console.error(`[${task}] Schema validation failed on first attempt, retrying:`, firstErr);
  }

  const retryTemp = Math.min(0.9, (options?.temperature ?? 0.7) + 0.1);

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
    retryContent = await callAPI(retryMessages, activeModel, retryTemp);
  } catch (err) {
    console.error(`[${task}] LLM API error on retry:`, err);
    return makeFallback();
  }

  try {
    const data = schema.parse(JSON.parse(retryContent));
    return { data, meta: { model: activeModel, fallback: false } };
  } catch (retryErr) {
    console.error(`[${task}] Schema validation failed on retry:`, retryErr);
    return makeFallback();
  }
}
