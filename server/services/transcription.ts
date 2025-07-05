import Groq from "groq-sdk";
import OpenAI from "openai";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export async function transcribeAudio(audioFile: File): Promise<string> {
  // Try Groq first
  try {
    console.log("Attempting transcription with Groq...");
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3",
      response_format: "text"
    });
    
    console.log("Groq transcription successful:", transcription);
    // Groq returns the text directly when response_format is "text"
    return String(transcription);
  } catch (groqError) {
    console.log("Groq transcription failed, falling back to OpenAI:", groqError);
    
    // Fallback to OpenAI Whisper
    try {
      console.log("Attempting transcription with OpenAI Whisper...");
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        response_format: "text"
      });
      
      console.log("OpenAI transcription successful:", transcription);
      // OpenAI returns the text directly when response_format is "text"
      return String(transcription);
    } catch (openaiError) {
      console.error("Both Groq and OpenAI transcription failed:", {
        groqError,
        openaiError
      });
      throw new Error("Transcription failed with both services");
    }
  }
}