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
          content: "You are an academic assistant helping students with test questions. Provide clear, helpful responses to clarifying questions about academic tasks. Keep responses concise but informative. Use markdown formatting for better readability."
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

export async function generateFollowUpQuestions(originalQuestion: string): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an academic test generator. Based on the original question, generate 2 follow-up questions that build upon the same theme but explore different aspects. Each follow-up should be answerable in 10 minutes and 250 words. Return only the questions, one per line."
        },
        {
          role: "user",
          content: `Original question: ${originalQuestion}\n\nGenerate 2 follow-up questions that explore related but different aspects of this topic.`
        }
      ],
      max_tokens: 300,
      temperature: 0.8
    });

    const content = response.choices[0].message.content || "";
    const questions = content.split('\n').filter(q => q.trim().length > 0).slice(0, 2);
    
    return questions.length === 2 ? questions : [
      "Based on your previous analysis, what alternative outcomes might have occurred if different conditions were present?",
      "How might the concepts you discussed apply to a different time period or geographical region?"
    ];
  } catch (error) {
    console.error("OpenAI API error:", error);
    return [
      "Based on your previous analysis, what alternative outcomes might have occurred if different conditions were present?",
      "How might the concepts you discussed apply to a different time period or geographical region?"
    ];
  }
}
