import { generateAIResponse, generateStructuredResponse } from "./ai-sdk";

export interface DetailedGrade {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export async function gradeAnswer(question: string, answer: string): Promise<number> {
  try {
    const systemPrompt = "You are an expert academic grader. Grade the student's answer to the given question on a scale of 0-25 points. Consider accuracy, depth of analysis, use of evidence, and clarity of argument. Respond with only the numeric score.";
    
    const prompt = `Question: ${question}\n\nStudent Answer: ${answer}\n\nProvide a score from 0-25 points.`;

    const response = await generateAIResponse(prompt, systemPrompt);
    const scoreText = response.trim();
    const score = parseInt(scoreText.replace(/[^\d]/g, ""));
    
    return Math.max(0, Math.min(25, score || 0));
  } catch (error) {
    console.error("Error grading answer:", error);
    return 0;
  }
}

export async function gradeAnswerWithFeedback(question: string, answer: string): Promise<DetailedGrade> {
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert academic grader. Grade the student's answer and provide detailed feedback. 
          Return a JSON object with:
          - score: numeric score from 0-25 points
          - feedback: overall assessment in 2-3 sentences
          - strengths: array of 2-3 specific strengths
          - improvements: array of 2-3 specific areas for improvement
          
          Consider accuracy, depth of analysis, use of evidence, and clarity of argument.`
        },
        {
          role: "user",
          content: `Question: ${question}\n\nStudent Answer: ${answer}\n\nProvide detailed grading feedback.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      score: Math.max(0, Math.min(25, result.score || 0)),
      feedback: result.feedback || "No feedback available.",
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      improvements: Array.isArray(result.improvements) ? result.improvements : []
    };
  } catch (error) {
    console.error("Error grading answer with feedback:", error);
    return {
      score: 0,
      feedback: "Unable to provide feedback due to an error.",
      strengths: [],
      improvements: []
    };
  }
}

export async function gradeAllAnswers(questions: string[], answers: string[]): Promise<number[]> {
  const grades: number[] = [];
  
  for (let i = 0; i < questions.length; i++) {
    if (answers[i] && answers[i].trim()) {
      const grade = await gradeAnswer(questions[i], answers[i]);
      grades.push(grade);
    } else {
      grades.push(0);
    }
  }
  
  return grades;
}

export async function gradeAllAnswersWithFeedback(questions: string[], answers: string[]): Promise<DetailedGrade[]> {
  const detailedGrades: DetailedGrade[] = [];
  
  for (let i = 0; i < questions.length; i++) {
    if (answers[i] && answers[i].trim()) {
      const grade = await gradeAnswerWithFeedback(questions[i], answers[i]);
      detailedGrades.push(grade);
    } else {
      detailedGrades.push({
        score: 0,
        feedback: "No answer provided.",
        strengths: [],
        improvements: ["Provide a complete answer to the question."]
      });
    }
  }
  
  return detailedGrades;
}