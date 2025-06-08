import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Message from './Message';

// The URL for your backend server
const API_URL = 'http://localhost:3000';

// Initialize the SpeechRecognition object.
// We make it a ref to prevent re-initialization on every render.
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const ChatWindow = () => {
  const [messages, setMessages] = useState([
    {
      role: 'model',
      parts: [{ text: "hello coder army!" }],
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false); // New state for processing audio
  const [isPlayingAudio, setIsPlayingAudio] = useState(false); // New state for when audio is actually playing
  const [showGuide, setShowGuide] = useState(false); // New state for showing user guide
  const [guideStep, setGuideStep] = useState(0); // Track guide steps
  
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const recordingTimerRef = useRef(null); // Timer for auto-stop recording

  // Check if user is visiting for the first time
  useEffect(() => {
    const hasVisited = localStorage.getItem('chat-app-visited');
    if (!hasVisited) {
      setShowGuide(true);
      localStorage.setItem('chat-app-visited', 'true');
    }
  }, []);

  // Effect to set up speech recognition once
  useEffect(() => {
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;
      
      recognition.continuous = true; // Keep listening until manually stopped
      recognition.interimResults = true; // Show live transcript
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
        // Start 10-second timer to auto-stop recording
        recordingTimerRef.current = setTimeout(() => {
          if (recognitionRef.current && isRecording) {
            recognitionRef.current.stop();
          }
        }, 10000); // 10 seconds
      };

      recognition.onend = () => {
        setIsRecording(false);
        // Clear the timer when recording ends
        if (recordingTimerRef.current) {
          clearTimeout(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        setIsProcessingAudio(false);
        setIsPlayingAudio(false);
        // Clear the timer on error
        if (recordingTimerRef.current) {
          clearTimeout(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        // Update the input field with the live transcript
        setInput(finalTranscript + interimTranscript);
      };
    }
  }, []); // Empty dependency array ensures this runs only once

  // Effect to scroll to the bottom of the chat on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isProcessingAudio]);

  // Unified function to send data to the backend
  const sendMessage = async (textToSend, requestVoice) => {
    if (!textToSend.trim()) return;

    setIsLoading(true);
    if (requestVoice) {
      setIsProcessingAudio(true); // Set processing audio state
    }

    try {
      const history = messages.map(msg => ({
        role: msg.role,
        parts: msg.parts.map(part => ({ text: part.text })),
      }));
      
      const userMessage = { role: 'user', parts: [{ text: textToSend }] };

      const response = await axios.post(`${API_URL}/chatwithnegi`, {
        history: [...history, userMessage],
        voice: requestVoice, // <<< Key change: conditional voice request
      });

      const nekoResponse = response.data;
      
      // Only add the message to chat if it's NOT a voice response
      if (!requestVoice) {
        const nekoMessage = {
          role: 'model',
          parts: [{ text: nekoResponse.message }],
        };
        setMessages(prev => [...prev, nekoMessage]);
      }

      // If an audio URL is returned, play it automatically without showing controls
      if (nekoResponse.audioUrl) {
        const audio = new Audio(`${API_URL}${nekoResponse.audioUrl}`);
        
        // Set audio properties to hide controls and play automatically
        audio.controls = false;
        audio.autoplay = true;
        
        // When audio starts playing, update states
        audio.onloadeddata = () => {
          setIsProcessingAudio(false); // Remove "Please wait..."
          setIsPlayingAudio(true); // Indicate audio is playing
        };
        
        // Play the audio and handle completion
        audio.play()
          .then(() => {
            console.log("Audio started playing");
          })
          .catch(err => {
            console.error("Audio playback failed:", err);
            setIsProcessingAudio(false);
            setIsPlayingAudio(false);
          });
        
        // When audio finishes playing, reset the states
        audio.onended = () => {
          setIsProcessingAudio(false);
          setIsPlayingAudio(false);
        };
        
        // Handle audio loading errors
        audio.onerror = () => {
          console.error("Audio loading failed");
          setIsProcessingAudio(false);
          setIsPlayingAudio(false);
        };
      } else if (requestVoice) {
        // If voice was requested but no audio URL returned, reset processing state
        setIsProcessingAudio(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        role: 'model',
        parts: [{ text: 'Mrow! Something went wrong. Please try again later.' }],
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsProcessingAudio(false); // Reset on error
      setIsPlayingAudio(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for typed text submission
  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading || isProcessingAudio || isPlayingAudio) return;

    // Add user's typed message to UI immediately
    const userMessage = { role: 'user', parts: [{ text: input }] };
    setMessages(prev => [...prev, userMessage]);

    // Send to backend, requesting NO voice response
    sendMessage(input, false);
    setInput('');
  };

  // Handler for the microphone button
  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Sorry, your browser doesn't support speech recognition.");
      return;
    }

    if (isRecording) {
      // --- STOP RECORDING ---
      recognitionRef.current.stop();
      // Clear the timer manually when user stops recording
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      // The `onend` event will fire, and we'll process the result there
      // We send the message *after* the final transcript is processed.
      // The `input` state already holds the final transcript thanks to `onresult`.
      
      // We send the final transcript. Because this is from the mic, we request a voice response.
      // Your spoken message is NOT added to the chat UI, as requested.
      sendMessage(input, true);
      setInput(''); // Clear input after sending
    } else {
      // --- START RECORDING ---
      setInput(''); // Clear input field to prepare for new transcript
      recognitionRef.current.start();
    }
  };

  // Function to get the current status text
  const getStatusText = () => {
    if (isProcessingAudio) return 'Please wait...';
    if (isPlayingAudio) return 'Online'; // Show Online when audio is playing
    if (isLoading) return 'Thinking...';
    if (isRecording) return 'Listening...';
    return 'Online';
  };

  // Guide step content
  const guideSteps = [
    {
      title: "Welcome to Voice Chat! 🎤",
      description: "For the best experience, please switch to Google Chrome browser. Let me show you how to use the voice feature to chat with Rohit bhiya.",
      action: "Get Started"
    },
    {
      title: "Step 1: Click the Mic 🎙️",
      description: "Click the microphone button to start recording your voice message.",
      action: "Next"
    },
    {
      title: "Step 2: Speak Your Message 🗣️",
      description: "Speak clearly into your microphone. You'll see your words appear as you talk.",
      action: "Next"
    },
    {
      title: "Step 3: Click Mic Again to Send 📤",
      description: "When you're done speaking (or after 10 seconds), click the microphone button again to automatically send your message and get a voice reply!",
      action: "Next"
    },
    {
      title: "Ready to Chat! ✨",
      description: "You're all set! For the best voice experience, we recommend using Google Chrome browser. Happy chatting!",
      action: "Got it!"
    }
  ];

  const nextGuideStep = () => {
    if (guideStep < guideSteps.length - 1) {
      setGuideStep(guideStep + 1);
    } else {
      setShowGuide(false);
      setGuideStep(0);
    }
  };

  const skipGuide = () => {
    setShowGuide(false);
    setGuideStep(0);
  };

  return (
    <div className="chat-window">
      {/* User Guide Overlay */}
      {showGuide && (
        <div className="guide-overlay">
          <div className="guide-backdrop" onClick={skipGuide}></div>
          <div className="guide-modal">
            <div className="guide-header">
              <div className="guide-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${((guideStep + 1) / guideSteps.length) * 100}%` }}
                  ></div>
                </div>
                <span className="progress-text">{guideStep + 1} of {guideSteps.length}</span>
              </div>
              <button className="guide-close" onClick={skipGuide}>✕</button>
            </div>
            
            <div className="guide-content">
              <div className="guide-icon">
                {guideStep === 0 && "👋"}
                {guideStep === 1 && "🎙️"}
                {guideStep === 2 && "🗣️"}
                {guideStep === 3 && "📤"}
                {guideStep === 4 && "✨"}
              </div>
              <h3 className="guide-title">{guideSteps[guideStep].title}</h3>
              <p className="guide-description">{guideSteps[guideStep].description}</p>
              
              {guideStep === 1 && (
                <div className="guide-demo">
                  <div className="demo-mic-button">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                      <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.75 6.75 0 11-13.5 0v-1.5A.75.75 0 016 10.5z" />
                    </svg>
                    <div className="demo-pulse"></div>
                  </div>
                  <p className="demo-text">Click here to start</p>
                </div>
              )}
            </div>
            
            <div className="guide-actions">
              <button className="guide-skip" onClick={skipGuide}>Skip Tour</button>
              <button className="guide-next" onClick={nextGuideStep}>
                {guideSteps[guideStep].action}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="chat-header">
        <img src="/rohit.jpg" alt="Neko Avatar" />
        <div>
          <h2>Rohit bhiya</h2>
          <p className="status">{getStatusText()}</p>
        </div>
      </header>

      <div className="messages-list">
        {messages.map((msg, index) => (
          <Message key={index} message={msg} />
        ))}
        {(isLoading || (isProcessingAudio && !isPlayingAudio)) && (
          <Message 
            message={{ 
              role: 'model', 
              parts: [{ text: isProcessingAudio && !isPlayingAudio ? 'Please wait...' : '' }] 
            }} 
            isLoading={isLoading && !isProcessingAudio} 
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleTextSubmit}>
        <input
          type="text"
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isProcessingAudio && !isPlayingAudio
              ? 'Please wait...' 
              : isRecording 
                ? 'Listening for your voice...' 
                : 'Type a message or click the mic'
          }
          disabled={isLoading || isRecording || isProcessingAudio || isPlayingAudio}
        />
        
        {/* Mic Button */}
        <button
          type="button"
          className={`mic-button ${isRecording ? 'recording' : ''}`}
          onClick={toggleRecording}
          disabled={isLoading || isProcessingAudio || isPlayingAudio}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
            <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.75 6.75 0 11-13.5 0v-1.5A.75.75 0 016 10.5z" />
          </svg>
        </button>

        {/* Send Button for Text */}
        <button 
          type="submit" 
          className="send-button" 
          disabled={isLoading || isRecording || isProcessingAudio || isPlayingAudio || !input.trim()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
          </svg>
        </button>
      </form>

      <style jsx>{`
        .guide-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease-out;
        }

        .guide-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
        }

        .guide-modal {
          position: relative;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          padding: 0;
          max-width: 400px;
          width: 90%;
          color: white;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.4s ease-out;
          overflow: hidden;
        }

        .guide-header {
          padding: 20px 20px 0;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .guide-progress {
          flex: 1;
        }

        .progress-bar {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          height: 100%;
          background: white;
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 12px;
          opacity: 0.8;
        }

        .guide-close {
          background: none;
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 0.2s;
          padding: 4px;
          margin-left: 15px;
        }

        .guide-close:hover {
          opacity: 1;
        }

        .guide-content {
          padding: 30px 30px 20px;
          text-align: center;
        }

        .guide-icon {
          font-size: 48px;
          margin-bottom: 20px;
          animation: bounce 2s infinite;
        }

        .guide-title {
          font-size: 24px;
          font-weight: bold;
          margin: 0 0 15px 0;
          line-height: 1.2;
        }

        .guide-description {
          font-size: 16px;
          line-height: 1.5;
          opacity: 0.9;
          margin: 0 0 20px 0;
        }

        .guide-demo {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
        }

        .demo-mic-button {
          position: relative;
          width: 60px;
          height: 60px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulse 2s infinite;
        }

        .demo-mic-button svg {
          width: 24px;
          height: 24px;
          fill: white;
        }

        .demo-pulse {
          position: absolute;
          top: -5px;
          left: -5px;
          right: -5px;
          bottom: -5px;
          border: 2px solid rgba(255, 255, 255, 0.5);
          border-radius: 50%;
          animation: pulseRing 2s infinite;
        }

        .demo-text {
          font-size: 14px;
          opacity: 0.8;
          margin: 0;
        }

        .guide-actions {
          padding: 20px 30px 30px;
          display: flex;
          gap: 15px;
          justify-content: space-between;
        }

        .guide-skip {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          padding: 12px 20px;
          border-radius: 25px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }

        .guide-skip:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .guide-next {
          background: white;
          color: #667eea;
          border: none;
          padding: 12px 24px;
          border-radius: 25px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
          flex: 1;
          font-size: 14px;
        }

        .guide-next:hover {
          transform: translateY(-1px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }

        @keyframes pulseRing {
          0% { 
            transform: scale(0.8);
            opacity: 1;
          }
          100% { 
            transform: scale(1.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default ChatWindow;