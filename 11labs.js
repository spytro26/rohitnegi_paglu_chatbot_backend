import { ElevenLabsClient, play } from '@elevenlabs/elevenlabs-js';
import 'dotenv/config';
import fs from 'fs';
const elevenlabs = new ElevenLabsClient();
const audio = await elevenlabs.textToSpeech.convert('Qxb5zQvEo3DYQK2HNnXm', {
  text: 'par bhiya ye mujhe samajh nahi aya ha bhiya chamak gya.',
  modelId: 'eleven_multilingual_v2',
  outputFormat: 'mp3_44100_128',
});



fs.writeFileSync('./public/response.mp3', Buffer.from(audio));


