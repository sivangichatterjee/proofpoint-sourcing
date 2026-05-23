import Together from "together-ai";
import OpenAI from "openai";
import { ZodSchema } from "zod";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export type LLMTask = "relevance_filter" | "profile_generation" | "thesis_fit" | "company_analysis" | "agent_planner";

// const MODEL_ROUTING: Record<LLMTask, string> = {
//   relevance_filter: "deepseek-ai/DeepSeek-V3",
//   profile_generation: "deepseek-ai/DeepSeek-V3",
//   thesis_fit: "deepseek-ai/DeepSeek-V3",
// };

const MODEL_ROUTING: Record<LLMTask, string> = {
  relevance_filter: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  profile_generation: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  thesis_fit: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  company_analysis: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  agent_planner: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
};

type LLMProvider = "together" | "openai";

const MODEL_PROVIDER: Record<string, LLMProvider> = {
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": "together",
  "deepseek-ai/DeepSeek-V4-Pro": "together",
  "openai/gpt-oss-20b": "together",
  "gpt-4o-mini": "openai",
};

const MODEL_FALLBACK: Partial<Record<string, string>> = {
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": "deepseek-ai/DeepSeek-V4-Pro",
  "deepseek-ai/DeepSeek-V4-Pro": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  "openai/gpt-oss-20b": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  "gpt-4o-mini": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
};

export const PROMPT_VERSION = "v1";

function buildStructuredResponseFormat<T>(task: LLMTask, schema: ZodSchema<T>) {
  const schemaWithJson = schema as ZodSchema<T> & {
    toJSONSchema?: () => { [key: string]: unknown };
  };

  if (typeof schemaWithJson.toJSONSchema === "function") {
    return {
      type: "json_schema" as const,
      json_schema: {
        name: `${task}_response`,
        description: `Structured response for ${task}`,
        schema: schemaWithJson.toJSONSchema(),
        strict: true,
      },
    };
  }

  return { type: "json_object" as const };
}

function extractJson(raw: string): string {
  // Strip DeepSeek <think>...</think> reasoning blocks
  let s = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // Strip markdown code fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  // Grab from first { to last } (or [ to ])
  const objStart = s.indexOf("{");
  const objEnd = s.lastIndexOf("}");
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    return s.slice(objStart, objEnd + 1);
  }
  return s;
}

const MAX_TOKENS: Record<LLMTask, number> = {
  relevance_filter: 400,
  profile_generation: 1500,
  thesis_fit: 800,
  company_analysis: 2200,
  agent_planner: 500,
};

function maxTokensFor(task: LLMTask, model: string): number {
  if (model === "deepseek-ai/DeepSeek-V4-Pro") {
    return {
      relevance_filter: 800,
      profile_generation: 2500,
      thesis_fit: 1800,
      company_analysis: 3200,
      agent_planner: 1000,
    }[task];
  }

  return MAX_TOKENS[task];
}

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
  options?: {
    temperature?: number;
    buildFallback?: () => T | null;
    modelOverride?: string;
    allowModelFallback?: boolean;
  }
): Promise<LLMCallResult<T>> {
  const model = options?.modelOverride ?? MODEL_ROUTING[task];
  const temperature = options?.temperature ?? 0.2;
  const allowModelFallback = options?.allowModelFallback ?? true;
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
        max_tokens: maxTokensFor(task, modelToUse),
      });
      const choice = response.choices[0];
      const content = choice?.message?.content ?? "";
      if (choice?.finish_reason === "length" || !content.trim()) {
        console.warn(
          `[${task}] ${modelToUse} returned ${choice?.finish_reason ?? "no finish reason"} with ${content.length} content chars`
        );
      }
      return content;
    } else {
      const response = await together.chat.completions.create({
        model: modelToUse,
        messages,
        response_format: buildStructuredResponseFormat(task, schema),
        reasoning: modelToUse === "openai/gpt-oss-20b" ? { enabled: false } : undefined,
        reasoning_effort: modelToUse === "openai/gpt-oss-20b" ? "low" : undefined,
        temperature: temp,
        max_tokens: maxTokensFor(task, modelToUse),
      });
      const choice = response.choices[0];
      const content = choice?.message?.content ?? "";
      if (choice?.finish_reason === "length" || !content.trim()) {
        console.warn(
          `[${task}] ${modelToUse} returned ${choice?.finish_reason ?? "no finish reason"} with ${content.length} content chars`
        );
      }
      return content;
    }
  }

  let firstContent: string;
  let activeModel = model;

  try {
    firstContent = await callAPI(baseMessages, model, temperature);
  } catch (firstCallErr: unknown) {
    const e = firstCallErr as { status?: number; message?: string };
    console.error(`[${task}] LLM API error (model: ${model}, status: ${e?.status}):`, e?.message ?? firstCallErr);
    const fallbackModel = MODEL_FALLBACK[model];

    if (allowModelFallback && fallbackModel) {
      console.warn(`[${task}] ${model} failed — waiting 2s then retrying with ${fallbackModel}`);
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
      return makeFallback();
    }
  }

  try {
    const data = schema.parse(JSON.parse(extractJson(firstContent)));
    return { data, meta: { model: activeModel, fallback: false } };
  } catch (firstErr) {
    console.error(`[${task}] Schema validation failed on first attempt, retrying:`, firstErr);
    console.error(`[${task}] Raw content (first 300 chars):`, firstContent?.slice(0, 300));
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
    const data = schema.parse(JSON.parse(extractJson(retryContent)));
    return { data, meta: { model: activeModel, fallback: false } };
  } catch (retryErr) {
    console.error(`[${task}] Schema validation failed on retry:`, retryErr);
    console.error(`[${task}] Raw retry content (first 300 chars):`, retryContent?.slice(0, 300));
    return makeFallback();
  }
}
