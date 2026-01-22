import React from 'react';
import { useSocket } from './hooks/useSocket';
import { Lobby, JoinForm } from './components/Lobby';
import { GameBoard } from './components/GameBoard';

function App() {
  const {
    connected,
    roomId,
    playerId,
    gameState,
    gameConfig,
    chatMessages,
    error,
    createRoom,
    joinRoom,
    startGame,
    drawCard,
    playCampaign,
    skipCampaign,
    proposePolicy,
    skipProposal,
    castVote,
    acknowledgeWildcard,
    adjustIssue,
    exportGame,
    sendChat,
    clearError,
  } = useSocket();

  // Show connection status
  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to server...</p>
          {error && (
            <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg max-w-md">
              {error}
              <button
                onClick={clearError}
                className="ml-2 underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show join/create form if not in a room
  if (!roomId || !playerId) {
    return (
      <div className="min-h-screen bg-gray-100 py-12">
        <JoinForm
          onJoin={(roomId, playerName, partyName, socialIdeology, economicIdeology) => 
            joinRoom(roomId, playerName, partyName, socialIdeology, economicIdeology)
          }
          onCreate={(playerName, partyName, configOverrides, socialIdeology, economicIdeology) => 
            createRoom(playerName, partyName, configOverrides, socialIdeology, economicIdeology)
          }
        />
        {error && (
          <div className="max-w-md mx-auto mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
            <button
              onClick={clearError}
              className="ml-2 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  }

  // Show lobby if game hasn't started
  if (!gameState || gameState.phase === 'waiting') {
    return (
      <div className="min-h-screen bg-gray-100 py-12">
        {gameState && gameConfig && (
          <Lobby
            gameState={gameState}
            gameConfig={gameConfig}
            playerId={playerId}
            onStartGame={startGame}
            onUpdateConfig={(config) => {
              // The updateConfig function needs to be imported from useSocket
              // For now, we'll need to add it
            }}
          />
        )}
        {error && (
          <div className="max-w-md mx-auto mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
            <button
              onClick={clearError}
              className="ml-2 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  }

  // Show game board
  return (
    <>
      <GameBoard
        gameState={gameState}
        gameConfig={gameConfig!}
        playerId={playerId}
        chatMessages={chatMessages}
        onDrawCard={drawCard}
        onPlayCampaign={playCampaign}
        onSkipCampaign={skipCampaign}
        onProposePolicy={proposePolicy}
        onSkipProposal={skipProposal}
        onCastVote={castVote}
        onAcknowledgeWildcard={acknowledgeWildcard}
        onAdjustIssue={adjustIssue}
        onExportGame={exportGame}
        onSendChat={sendChat}
      />
      {error && (
        <div className="fixed bottom-4 right-4 p-4 bg-red-100 text-red-700 rounded-lg shadow-lg">
          {error}
          <button
            onClick={clearError}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}

export default App;
