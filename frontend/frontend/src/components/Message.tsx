import React from 'react';

// Using a public URL for the avatar
const nekoAvatar = '/rohit.jpg';

const TypingIndicator = () => (
  <div className="message-container neko">
    <img src={nekoAvatar} alt="Neko" className="avatar" />
    <div className="message-bubble">
      <div className="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </div>
);

const Message = ({ message, isLoading }) => {
  const { role, parts } = message;
  const isNeko = role === 'model';
  const text = parts[0]?.text || '';

  if (isLoading && isNeko) {
    return <TypingIndicator />;
  }
  
  return (
    <div className={`message-container ${isNeko ? 'neko' : 'user'}`}>
      {isNeko && <img src={nekoAvatar} alt="Neko" className="avatar" />}
      <div className="message-bubble">
        {text.split('\n').map((line, index) => (
          <React.Fragment key={index}>
            {line}
            <br />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default Message;