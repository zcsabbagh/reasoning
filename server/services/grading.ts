import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function gradeAnswer(question: string, answer: string): Promise<number> {
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert academic grader. Grade the student's answer to the given question on a scale of 0-25 points. Consider accuracy, depth of analysis, use of evidence, and clarity of argument. Respond with only the numeric score."
        },
        {
          role: "user",
          content: `Question: ${question}\n\nStudent Answer: ${answer}\n\nProvide a score from 0-25 points.`
        }
      ],
      max_tokens: 10,
      temperature: 0.3,
    });

    const scoreText = response.choices[0].message.content?.trim() || "0";
    const score = parseInt(scoreText.replace(/[^\d]/g, ""));
    
    return Math.max(0, Math.min(25, score || 0));
  } catch (error) {
    console.error("Error grading answer:", error);
    return 0;
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