import { generateAIResponse } from "./ai-sdk";

export async function getClarificationResponse(question: string, taskContext: string): Promise<string> {
  try {
    const systemPrompt = "You are an academic assistant helping students with test questions. Provide clear, helpful responses to clarifying questions about academic tasks. Keep responses concise but informative. Use markdown formatting for better readability.";
    
    const prompt = `Task context: ${taskContext}\n\nStudent question: ${question}`;
    
    return await generateAIResponse(prompt, systemPrompt);
  } catch (error) {
    console.error("AI API error:", error);
    throw new Error("Failed to get AI response. Please check your API key and try again.");
  }
}

export async function generateFollowUpQuestions(originalQuestion: string): Promise<string[]> {
  try {
    const systemPrompt = "You are an academic test generator. Based on the original question, generate 2 follow-up questions that build upon the same theme but explore different aspects. Each follow-up should be answerable in 10 minutes and 250 words. Return only the questions, one per line.";
    
    const prompt = `Original question: ${originalQuestion}\n\nGenerate 2 follow-up questions that explore related but different aspects of this topic.`;
    
    const response = await generateAIResponse(prompt, systemPrompt);
    const questions = response.split('\n').filter(q => q.trim().length > 0).slice(0, 2);
    
    return questions.length === 2 ? questions : [
      "Based on your previous analysis, what alternative outcomes might have occurred if different conditions were present?",
      "How might the concepts you discussed apply to a different time period or geographical region?"
    ];
  } catch (error) {
    console.error("AI API error:", error);
    return [
      "Based on your previous analysis, what alternative outcomes might have occurred if different conditions were present?",
      "How might the concepts you discussed apply to a different time period or geographical region?"
    ];
  }
}
