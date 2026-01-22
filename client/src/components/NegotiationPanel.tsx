import React, { useState } from 'react';
import { GameState, Player, HandCard, TradeOffer, CampaignCard, PolicyCard } from '../types';
import { Users, Check, X, Send, CheckCircle2, Clock, RefreshCw } from 'lucide-react';

interface NegotiationPanelProps {
  gameState: GameState;
  playerId: string;
  onMakeOffer: (toPlayerId: string, offered: string[], requested: string[]) => void;
  onRespond: (offerId: string, accept: boolean) => void;
  onCancel: (offerId: string) => void;
  onReady: () => void;
}

export function NegotiationPanel({
  gameState,
  playerId,
  onMakeOffer,
  onRespond,
  onCancel,
  onReady,
}: NegotiationPanelProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [offeredCards, setOfferedCards] = useState<string[]>([]);
  const [requestedCards, setRequestedCards] = useState<string[]>([]);
  const [showOfferBuilder, setShowOfferBuilder] = useState(false);
  
  // Counter-offer state
  const [counterOfferMode, setCounterOfferMode] = useState<string | null>(null); // offerId being countered
  const [counterOffered, setCounterOffered] = useState<string[]>([]);
  const [counterRequested, setCounterRequested] = useState<string[]>([]);

  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const otherPlayers = gameState.players.filter(p => p.id !== playerId);
  const isReady = gameState.negotiation.playersReady.includes(playerId);
  
  const myOffers = gameState.negotiation.activeOffers.filter(o => o.fromPlayerId === playerId);
  const offersToMe = gameState.negotiation.activeOffers.filter(o => o.toPlayerId === playerId);

  const handleSubmitOffer = () => {
    if (selectedPlayer && offeredCards.length > 0) {
      onMakeOffer(selectedPlayer, offeredCards, requestedCards);
      setOfferedCards([]);
      setRequestedCards([]);
      setShowOfferBuilder(false);
      setSelectedPlayer(null);
    }
  };

  const handleSubmitCounterOffer = (originalOffer: TradeOffer) => {
    // Counter-offer: I become the offerer, they become recipient
    // My offered = what I'm willing to give (counterOffered)
    // My requested = what I want from them (counterRequested)
    onMakeOffer(originalOffer.fromPlayerId, counterOffered, counterRequested);
    
    // Reject the original offer
    onRespond(originalOffer.id, false);
    
    // Reset counter-offer state
    setCounterOfferMode(null);
    setCounterOffered([]);
    setCounterRequested([]);
  };

  const startCounterOffer = (offer: TradeOffer) => {
    setCounterOfferMode(offer.id);
    // Pre-populate with their original request as what they might want
    setCounterRequested([...offer.offeredCardIds]);
    setCounterOffered([]);
  };

  const toggleCard = (cardId: string, list: string[], setList: (cards: string[]) => void) => {
    if (list.includes(cardId)) {
      setList(list.filter(id => id !== cardId));
    } else {
      setList([...list, cardId]);
    }
  };

  const targetPlayer = selectedPlayer ? gameState.players.find(p => p.id === selectedPlayer) : null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-500" />
          Negotiation Phase
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {gameState.negotiation.playersReady.length}/{gameState.players.length} ready
          </span>
          {!isReady ? (
            <button
              onClick={onReady}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark Ready
            </button>
          ) : (
            <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium flex items-center gap-2">
              <Check className="w-4 h-4" />
              Ready!
            </span>
          )}
        </div>
      </div>

      {/* Incoming offers */}
      {offersToMe.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium text-sm text-gray-600 mb-2">Incoming Offers</h4>
          <div className="space-y-3">
            {offersToMe.map(offer => {
              const fromPlayer = gameState.players.find(p => p.id === offer.fromPlayerId);
              const isCountering = counterOfferMode === offer.id;
              
              return (
                <div
                  key={offer.id}
                  className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full" style={{ backgroundColor: fromPlayer?.color }} />
                      <span className="font-medium">{fromPlayer?.name}</span>
                      <span className="text-sm text-gray-500">offers:</span>
                    </div>
                    {!isCountering && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => onRespond(offer.id, true)}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm flex items-center gap-1"
                        >
                          <Check className="w-4 h-4" /> Accept
                        </button>
                        <button
                          onClick={() => startCounterOffer(offer)}
                          className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-sm flex items-center gap-1"
                        >
                          <RefreshCw className="w-4 h-4" /> Counter
                        </button>
                        <button
                          onClick={() => onRespond(offer.id, false)}
                          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm flex items-center gap-1"
                        >
                          <X className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {!isCountering ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">They offer ({offer.offeredCardIds.length}):</div>
                        <div className="space-y-1">
                          {offer.offeredCardIds.map(cardId => {
                            const handCard = fromPlayer?.hand.find(h => h.card.id === cardId);
                            return handCard ? (
                              <DetailedMiniCard key={cardId} card={handCard.card} />
                            ) : (
                              <div key={cardId} className="text-xs text-gray-400">Unknown card</div>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">They want ({offer.requestedCardIds.length}):</div>
                        <div className="space-y-1">
                          {offer.requestedCardIds.map(cardId => {
                            const handCard = currentPlayer?.hand.find(h => h.card.id === cardId);
                            return handCard ? (
                              <DetailedMiniCard key={cardId} card={handCard.card} showFull />
                            ) : (
                              <div key={cardId} className="text-xs text-gray-400">Card not in hand</div>
                            );
                          })}
                          {offer.requestedCardIds.length === 0 && (
                            <div className="text-xs text-gray-400 italic">Nothing requested</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Counter-offer mode */
                    <div className="border-t border-blue-300 mt-3 pt-3">
                      <div className="text-sm font-medium text-yellow-700 mb-2 flex items-center gap-1">
                        <RefreshCw className="w-4 h-4" />
                        Make Counter-Offer
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <div className="text-xs text-gray-600 mb-1">
                            Your cards to offer ({counterOffered.length}):
                          </div>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {currentPlayer?.hand.map(handCard => (
                              <SelectableDetailedCard
                                key={handCard.card.id}
                                handCard={handCard}
                                selected={counterOffered.includes(handCard.card.id)}
                                onClick={() => toggleCard(handCard.card.id, counterOffered, setCounterOffered)}
                              />
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">
                            Cards you want ({counterRequested.length}):
                          </div>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {fromPlayer?.hand.map(handCard => (
                              <SelectableDetailedCard
                                key={handCard.card.id}
                                handCard={handCard}
                                selected={counterRequested.includes(handCard.card.id)}
                                onClick={() => toggleCard(handCard.card.id, counterRequested, setCounterRequested)}
                                showFull
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSubmitCounterOffer(offer)}
                          disabled={counterOffered.length === 0}
                          className={`flex-1 py-2 rounded font-medium text-sm flex items-center justify-center gap-1 ${
                            counterOffered.length > 0
                              ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          <Send className="w-4 h-4" />
                          Send Counter-Offer
                        </button>
                        <button
                          onClick={() => {
                            setCounterOfferMode(null);
                            setCounterOffered([]);
                            setCounterRequested([]);
                          }}
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* My pending offers */}
      {myOffers.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium text-sm text-gray-600 mb-2">Your Pending Offers</h4>
          <div className="space-y-2">
            {myOffers.map(offer => {
              const toPlayer = gameState.players.find(p => p.id === offer.toPlayerId);
              return (
                <div
                  key={offer.id}
                  className="p-3 bg-gray-50 rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">
                      Offer to <strong>{toPlayer?.name}</strong>: {offer.offeredCardIds.length} card(s)
                    </span>
                  </div>
                  <button
                    onClick={() => onCancel(offer.id)}
                    className="text-red-500 hover:text-red-600 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Make new offer */}
      {!showOfferBuilder ? (
        <button
          onClick={() => setShowOfferBuilder(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-lg text-gray-500 hover:text-purple-600 transition-colors"
        >
          + Make Trade Offer
        </button>
      ) : (
        <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium">New Trade Offer</h4>
            <button onClick={() => {
              setShowOfferBuilder(false);
              setSelectedPlayer(null);
              setOfferedCards([]);
              setRequestedCards([]);
            }} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Select player */}
          <div className="mb-4">
            <label className="text-sm text-gray-600 block mb-2">Trade with:</label>
            <div className="flex gap-2 flex-wrap">
              {otherPlayers.map(player => (
                <button
                  key={player.id}
                  onClick={() => setSelectedPlayer(player.id)}
                  className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${
                    selectedPlayer === player.id
                      ? 'ring-2 ring-purple-400 bg-white'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: player.color }} />
                  <span className="text-sm font-medium">{player.name}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedPlayer && currentPlayer && (
            <>
              {/* Cards you offer */}
              <div className="mb-4">
                <label className="text-sm text-gray-600 block mb-2">
                  Your cards to offer ({offeredCards.length} selected):
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {currentPlayer.hand.map(handCard => (
                    <SelectableDetailedCard
                      key={handCard.card.id}
                      handCard={handCard}
                      selected={offeredCards.includes(handCard.card.id)}
                      onClick={() => toggleCard(handCard.card.id, offeredCards, setOfferedCards)}
                      showFull
                    />
                  ))}
                </div>
              </div>

              {/* Cards you want */}
              <div className="mb-4">
                <label className="text-sm text-gray-600 block mb-2">
                  Cards you want ({requestedCards.length} selected):
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {targetPlayer?.hand.map(handCard => (
                    <SelectableDetailedCard
                      key={handCard.card.id}
                      handCard={handCard}
                      selected={requestedCards.includes(handCard.card.id)}
                      onClick={() => toggleCard(handCard.card.id, requestedCards, setRequestedCards)}
                      showFull
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleSubmitOffer}
                disabled={offeredCards.length === 0}
                className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                  offeredCards.length > 0
                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
                Send Offer
              </button>
            </>
          )}
        </div>
      )}

      {/* Your hand with full details */}
      <div className="mt-6 pt-4 border-t">
        <h4 className="font-medium text-sm text-gray-600 mb-2">Your Cards ({currentPlayer?.hand.length})</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {currentPlayer?.hand.map(handCard => (
            <FullCardDisplay key={handCard.card.id} handCard={handCard} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Detailed mini card showing ideology stances
function DetailedMiniCard({ card, showFull }: { card: CampaignCard | PolicyCard; showFull?: boolean }) {
  const isCampaign = 'seatDelta' in card;
  const hasStances = 'stanceTable' in card && card.stanceTable;
  
  return (
    <div className={`p-2 rounded text-xs ${isCampaign ? 'bg-red-100' : 'bg-blue-100'}`}>
      <div className="font-medium">{card.name}</div>
      {isCampaign && (
        <div className="text-green-700">+{(card as CampaignCard).seatDelta} seats</div>
      )}
      {showFull && hasStances && (
        <div className="mt-1 grid grid-cols-2 gap-x-2 text-[10px]">
          <StanceRow label="Prog" stance={card.stanceTable!.progressive} />
          <StanceRow label="Cons" stance={card.stanceTable!.conservative} />
          <StanceRow label="Mrkt" stance={card.stanceTable!.market} />
          <StanceRow label="Intv" stance={card.stanceTable!.interventionist} />
        </div>
      )}
    </div>
  );
}

function StanceRow({ label, stance }: { label: string; stance: string }) {
  const color = stance === 'favoured' ? 'text-green-600' : stance === 'opposed' ? 'text-red-600' : 'text-gray-400';
  return (
    <div className="flex justify-between">
      <span>{label}:</span>
      <span className={color}>{stance.charAt(0).toUpperCase()}</span>
    </div>
  );
}

// Selectable card with full ideology display
function SelectableDetailedCard({
  handCard,
  selected,
  onClick,
  showFull,
}: {
  handCard: HandCard;
  selected: boolean;
  onClick: () => void;
  showFull?: boolean;
}) {
  const { card, isNew } = handCard;
  const isCampaign = 'seatDelta' in card;
  const hasStances = 'stanceTable' in card && card.stanceTable;
  
  return (
    <div
      onClick={onClick}
      className={`p-2 rounded-lg border-2 cursor-pointer transition-all text-xs ${
        selected
          ? 'border-purple-500 bg-purple-100'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      } ${isNew ? 'ring-1 ring-yellow-400' : ''}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className={`px-1 py-0.5 rounded text-[10px] ${
          isCampaign ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {isCampaign ? 'C' : 'P'}
        </div>
        {isNew && <span className="text-yellow-600 text-[10px]">NEW</span>}
        {selected && <Check className="w-3 h-3 text-purple-600" />}
      </div>
      
      <div className="font-medium mt-1">{card.name}</div>
      
      {isCampaign && (
        <div className="text-green-600 font-medium">+{(card as CampaignCard).seatDelta}</div>
      )}
      
      {showFull && hasStances && (
        <div className="mt-1 pt-1 border-t grid grid-cols-2 gap-x-1 text-[10px]">
          <StanceRow label="Prog" stance={card.stanceTable!.progressive} />
          <StanceRow label="Cons" stance={card.stanceTable!.conservative} />
          <StanceRow label="Mrkt" stance={card.stanceTable!.market} />
          <StanceRow label="Intv" stance={card.stanceTable!.interventionist} />
        </div>
      )}
    </div>
  );
}

// Full card display for your hand section
function FullCardDisplay({ handCard }: { handCard: HandCard }) {
  const { card, isNew } = handCard;
  const isCampaign = 'seatDelta' in card;
  const hasStances = 'stanceTable' in card && card.stanceTable;
  const hasPolicyLink = isCampaign && (card as CampaignCard).policyLink;
  
  return (
    <div className={`p-3 rounded-lg border ${isNew ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between mb-1">
        <span className={`text-xs px-2 py-0.5 rounded ${
          isCampaign ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {isCampaign ? 'Campaign' : 'Policy'}
        </span>
        {isNew && <span className="text-xs text-yellow-600 font-medium">NEW</span>}
      </div>
      
      <div className="font-medium text-sm">{card.name}</div>
      <div className="text-xs text-gray-500 mt-0.5">{card.description}</div>
      
      {isCampaign && (
        <div className="text-sm font-bold text-green-600 mt-1">
          +{(card as CampaignCard).seatDelta} seats
        </div>
      )}
      
      {hasPolicyLink && (
        <div className="text-xs text-purple-600 mt-1">
          🔗 Links to policy (synergy bonus if passed)
        </div>
      )}
      
      {hasStances && (
        <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-1 text-xs">
          <div className="flex justify-between">
            <span>Progressive:</span>
            <span className={card.stanceTable!.progressive === 'favoured' ? 'text-green-600 font-medium' : card.stanceTable!.progressive === 'opposed' ? 'text-red-600 font-medium' : 'text-gray-400'}>
              {card.stanceTable!.progressive}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Conservative:</span>
            <span className={card.stanceTable!.conservative === 'favoured' ? 'text-green-600 font-medium' : card.stanceTable!.conservative === 'opposed' ? 'text-red-600 font-medium' : 'text-gray-400'}>
              {card.stanceTable!.conservative}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Market:</span>
            <span className={card.stanceTable!.market === 'favoured' ? 'text-green-600 font-medium' : card.stanceTable!.market === 'opposed' ? 'text-red-600 font-medium' : 'text-gray-400'}>
              {card.stanceTable!.market}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Interventionist:</span>
            <span className={card.stanceTable!.interventionist === 'favoured' ? 'text-green-600 font-medium' : card.stanceTable!.interventionist === 'opposed' ? 'text-red-600 font-medium' : 'text-gray-400'}>
              {card.stanceTable!.interventionist}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
