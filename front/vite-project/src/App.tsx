

import './App.css';
// VoiceChatApp.jsx
import React, { useState } from 'react';

function App() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAudioUrl(null);

    const updatedHistory = [
      ...history,
      { role: 'user', parts: [{ text: input }] }
    ];

    try {
      const response = await fetch('http://localhost:3000/chatwithnegi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: updatedHistory,
          voice: voiceEnabled
        })
      });

      const data = await response.json();
      setHistory([...updatedHistory, { role: 'model', parts: [{ text: data.message }] }]);

      if (data.audioUrl) {
        setAudioUrl(`http://localhost:3000${data.audioUrl}`);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded-2xl shadow-xl">
      <h1 className="text-2xl font-bold mb-4">🐱 Chat with Neko</h1>

      <form onSubmit={handleSubmit} className="mb-4 space-y-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="w-full p-2 border border-gray-300 rounded-xl"
          required
        />

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={voiceEnabled}
            onChange={() => setVoiceEnabled(!voiceEnabled)}
          />
          <span>Enable Voice</span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded-xl hover:bg-blue-600"
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </form>

      <div className="space-y-3">
        {history.map((msg, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-xl ${msg.role === 'user' ? 'bg-blue-100 text-right' : 'bg-gray-100 text-left'}`}
          >
            {msg.parts[0].text}
          </div>
        ))}
      </div>

      {audioUrl && (
        <audio controls autoPlay className="mt-4">
          <source src={audioUrl} type="audio/mp3" />
          Your browser does not support the audio element.
        </audio>
      )}
    </div>
  );
}

export default App;
