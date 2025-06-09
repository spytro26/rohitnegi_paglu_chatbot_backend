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
  apiKey: process.env.gemini_key,
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
      systemInstruction: `You are rohit , a youtuber with 2 youtbe channel coder army and Add commentMore actions
      rohit negi you have cleared gate with rank 202 in 2020 and studied in iit guwahati you did btech with tier 3 college 
       you worked in uber  with package 2 crore then left and created channel coder army in which you 
       you teached dsa in c++ and now teaching system design with guruji also mention in chat about nexus full stack  
        + blockchain  paid course. on rohit negi channel you are teaching the gen ai  you love to write code in c++ or js  you love love to hit gym daily you are gym rat , apart you love cricket  and read novels
        you always reply in hinglish you always  talk like  chamak gya for is it clear , or chalo bhai , out of the world feel ho raha tha 
        ,achhe se dhyaan rakhna hoga,atke mat raho for  don't get stucked   after some message market nexus positively not too much but after some time 
        and for motivation you say apne one day ko kabhi bhi kisi ke day 100 se compare  mat karna
         for Never compare your Day One to someone's Day 100  you always say your student this topic will Make you a BAAP Coder" (BAAP, literally 'father,' used colloquially to mean 'master' or 'boss' coder 
         you say i really hope app observe kar pa rahe hoge for i hope you are understanding ,  and you say five things to keep in mind: motivation, friend circle, progress, health, family) for success 
          and Coder Army ko next level lejane ki preparation chal rhi thi when someone asks whats going on or kya chal raha hai 
          dont reapeat the same thing again and again  each time give a diffrent response and take where you have to stop and dont answer to yourself. all i have given is the example  not exactly you have to follwo them . when someone asks 
          kya kar rahe ho then reply nexus ka next video pe kaam kar raha and something related to nexus not always the same anwer nexus is web dev + blokchain course`,
    },
  });
  return response.text;
}

// Generate and save voice with debug logs + error handling
async function generateVoiceAudio(text) {
  const voiceId = "FZkK3TvQ0pjyDmT8fzIW"; 
  const fileId = uuidv4();
  const filename = `response_${fileId}.mp3`;
  const filepath = `./public/${filename}`;

  console.log(" Generating voice audio...");
  console.log(" ELEVENLABS_API_KEY present:", !!process.env.ELEVENLABS_API_KEY);
  console.log(" Voice ID:", voiceId);

  // Guard: If key is missing
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY is missing! Check your deployment env variables.");
  }

  try {
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
        if (err) console.error(`🗑️ Failed to delete ${filename}:`, err);
        else console.log(`🧹 Deleted expired audio: ${filename}`);
      });
    }, 3 * 60 * 1000); // 3 minutes

    console.log(" Voice generation success:", filename);
    return `/${filename}`;
  } catch (err) {
    console.error(" ElevenLabs voice error:", err?.response?.status, err?.response?.data || err.message);
    throw new Error("Failed to generate voice from ElevenLabs. " + (err?.message || ""));
  }
}

// POST /chatwithnegi - main API
app.post("/chatwithnegi", async (req, res) => {
  const { history, voice } = req.body;
  console.log("💬 Received chatwithnegi request");

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
    console.error("🚨 Chat error:", e.message);
    return res.status(500).json({
      error: "Something went wrong",
      message: e.message,
    });
  }
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
