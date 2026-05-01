import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY is not set. AI features will be disabled.");
}

export const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

export const MODELS = {
  text: "gemini-3-flash-preview",
  image: "gemini-2.5-flash-image"
};
