import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

export async function getClarificationResponse(question: string, taskContext: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an academic assistant helping students with test questions. Provide clear, helpful responses to clarifying questions about academic tasks. Keep responses concise but informative."
        },
        {
          role: "user",
          content: `Task context: ${taskContext}\n\nStudent question: ${question}`
        }
      ],
      max_tokens: 200,
      temperature: 0.7
    });

    return response.choices[0].message.content || "I apologize, but I couldn't generate a response. Please try rephrasing your question.";
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to get AI response. Please check your API key and try again.");
  }
}
