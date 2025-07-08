import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

// The newest OpenAI model is "gpt-4o", not "gpt-4"
const DEFAULT_OPENAI_MODEL = 'gpt-4o';

// The newest Anthropic model is "claude-sonnet-4-20250514"
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

// The newest Gemini model is "gemini-2.5-flash"
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

interface AIProvider {
  name: string;
  model: any;
  apiKey: string | undefined;
}

export async function generateAIResponse(prompt: string, systemPrompt?: string): Promise<string> {
  const providers: AIProvider[] = [
    {
      name: 'OpenAI',
      model: openai(DEFAULT_OPENAI_MODEL),
      apiKey: process.env.OPENAI_API_KEY
    },
    {
      name: 'Anthropic',
      model: anthropic(DEFAULT_ANTHROPIC_MODEL),
      apiKey: process.env.ANTHROPIC_API_KEY
    },
    {
      name: 'Gemini',
      model: google(DEFAULT_GEMINI_MODEL),
      apiKey: process.env.GEMINI_API_KEY
    }
  ];

  let lastError: Error | null = null;

  for (const provider of providers) {
    if (!provider.apiKey) {
      console.log(`Skipping ${provider.name} - API key not configured`);
      continue;
    }

    try {
      console.log(`Attempting to generate response using ${provider.name}`);
      
      const result = await generateText({
        model: provider.model,
        prompt: prompt,
        system: systemPrompt,
        maxTokens: 1000,
      });

      console.log(`Successfully generated response using ${provider.name}`);
      return result.text;
    } catch (error) {
      lastError = error as Error;
      console.error(`${provider.name} failed:`, error);
      
      // Continue to next provider
      continue;
    }
  }

  // If all providers failed, throw the last error
  throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
}

export async function generateStructuredResponse<T>(
  prompt: string, 
  systemPrompt: string,
  schema: any
): Promise<T> {
  const providers: AIProvider[] = [
    {
      name: 'OpenAI',
      model: openai(DEFAULT_OPENAI_MODEL),
      apiKey: process.env.OPENAI_API_KEY
    },
    {
      name: 'Anthropic',
      model: anthropic(DEFAULT_ANTHROPIC_MODEL),
      apiKey: process.env.ANTHROPIC_API_KEY
    },
    {
      name: 'Gemini',
      model: google(DEFAULT_GEMINI_MODEL),
      apiKey: process.env.GEMINI_API_KEY
    }
  ];

  let lastError: Error | null = null;

  for (const provider of providers) {
    if (!provider.apiKey) {
      console.log(`Skipping ${provider.name} - API key not configured`);
      continue;
    }

    try {
      console.log(`Attempting to generate structured response using ${provider.name}`);
      
      const result = await generateText({
        model: provider.model,
        prompt: prompt,
        system: systemPrompt,
        maxTokens: 1000,
      });

      // Parse the JSON response
      const parsed = JSON.parse(result.text);
      console.log(`Successfully generated structured response using ${provider.name}`);
      return parsed as T;
    } catch (error) {
      lastError = error as Error;
      console.error(`${provider.name} failed:`, error);
      
      // Continue to next provider
      continue;
    }
  }

  // If all providers failed, throw the last error
  throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
}