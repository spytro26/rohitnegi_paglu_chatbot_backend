import { GoogleGenAI } from "@google/genai";
import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import "dotenv/config";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Serve audio files from /public

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: "AIzaSyDindyr2QyPkQwqs0h9jlhLSY5DYS79SSU",
});

// Initialize ElevenLabs
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// Converts Web ReadableStream (from ElevenLabs) to Buffer
async function streamToBuffer(webStream) {
  const reader = webStream.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

// Gemini chat logic
async function Chat(history) {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: history,
    config: {
      systemInstruction: "You are a cat. Your name is Neko.",
    },
  });
  return response.text;
}

// Generate and save voice
async function generateVoiceAudio(text) {
  const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel
  const fileId = uuidv4();
  const filename = `response_${fileId}.mp3`;
  const filepath = `./public/${filename}`;

  const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
    text,
    modelId: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
  });

  const audioBuffer = await streamToBuffer(audioStream);
  fs.writeFileSync(filepath, audioBuffer);

  // Auto-delete after 3 minutes
  setTimeout(() => {
    fs.unlink(filepath, (err) => {
      if (err) console.error(`❌ Failed to delete ${filename}:`, err);
      else console.log(`🧹 Deleted expired audio: ${filename}`);
    });
  }, 3 * 60 * 1000); // 3 minutes

  return `/${filename}`;
}

// POST /chatwithnegi - main API
app.post("/chatwithnegi", async (req, res) => {
  const { history, voice } = req.body;

  try {
    const responseText = await Chat(history);

    if (!responseText) throw new Error("No response from Gemini");

    let audioUrl = null;

    if (voice) {
      audioUrl = await generateVoiceAudio(responseText);
    }

    return res.status(200).json({
      message: responseText,
      ...(audioUrl && { audioUrl }),
    });
  } catch (e) {
    console.error("❌ Chat error:", e.message);
    return res.status(500).json({
      error: "Something went wrong",
      message: e.message,
    });
  }
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
