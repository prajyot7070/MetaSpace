import React from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, AlertTriangle } from 'lucide-react';

interface OptionsUIBarProps {
  show: boolean;
  isOnCall: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  error?: string | null;
  // Optional additional controls
  isMuted?: boolean;
  isVideoEnabled?: boolean;
  onToggleMute?: () => void;
  onToggleVideo?: () => void;
}

const OptionsUIBar: React.FC<OptionsUIBarProps> = ({ 
  show, 
  isOnCall, 
  onStartCall, 
  onEndCall,
  error,
  isMuted = false,
  isVideoEnabled = true,
  onToggleMute,
  onToggleVideo
}) => {
  if (!show) return null;

  return (
    <div className="options-ui-bar">
      <div className="options-content">
        <h3>Communication Options</h3>
        
        {error && (
          <div className="error-notification">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}
        
        <div className="call-controls">
          {!isOnCall ? (
            <button 
              className="call-button start-call"
              onClick={onStartCall}
            >
              <Phone size={16} />
              <span>Start Call</span>
            </button>
          ) : (
            <>
              <button 
                className="call-button end-call"
                onClick={onEndCall}
              >
                <PhoneOff size={16} />
                <span>End Call</span>
              </button>
              
              {onToggleMute && (
                <button 
                  className={`control-button ${isMuted ? 'active' : ''}`}
                  onClick={onToggleMute}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
              
              {onToggleVideo && (
                <button 
                  className={`control-button ${!isVideoEnabled ? 'active' : ''}`}
                  onClick={onToggleVideo}
                  title={isVideoEnabled ? "Disable Video" : "Enable Video"}
                >
                  {isVideoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .options-ui-bar {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background-color: rgba(50, 50, 50, 0.9);
          border-radius: 8px;
          padding: 16px;
          color: white;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
          z-index: 1000;
          width: 300px;
          backdrop-filter: blur(5px);
        }

        .options-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 500;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          padding-bottom: 8px;
        }

        .error-notification {
          display: flex;
          align-items: center;
          gap: 8px;
          background-color: rgba(255, 87, 51, 0.25);
          padding: 8px;
          border-radius: 4px;
          font-size: 12px;
          margin-bottom: 8px;
        }

        .call-controls {
          display: flex;
          justify-content: center;
          gap: 8px;
        }

        .call-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 50px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
          flex: 1;
        }

        .start-call {
          background-color: #4CAF50;
          color: white;
        }

        .start-call:hover {
          background-color: #3e8e41;
        }

        .end-call {
          background-color: #f44336;
          color: white;
        }

        .end-call:hover {
          background-color: #d32f2f;
        }

        .control-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: rgba(255, 255, 255, 0.2);
          color: white;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .control-button:hover {
          background-color: rgba(255, 255, 255, 0.3);
        }

        .control-button.active {
          background-color: #f44336;
        }
      `}</style>
    </div>
  );
};

export default OptionsUIBar;
