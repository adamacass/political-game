import React, { useState } from 'react';
import { GameState, Player, HandCard, TradeOffer, CampaignCard, PolicyCard } from '../types';
import { Users, Check, X, Send, CheckCircle2, Clock, RefreshCw } from 'lucide-react';

// Design tokens
const colors = {
  paper1: '#F4F1E8',
  paper2: '#EEEBE2',
  paper3: '#E8E5DC',
  ink: '#111111',
  inkSecondary: '#3A3A3A',
  rule: '#1A1A1A',
  success: '#16a34a',
  error: '#dc2626',
  warning: '#d97706',
};

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

  const [counterOfferMode, setCounterOfferMode] = useState<string | null>(null);
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
    onMakeOffer(originalOffer.fromPlayerId, counterOffered, counterRequested);
    onRespond(originalOffer.id, false);
    setCounterOfferMode(null);
    setCounterOffered([]);
    setCounterRequested([]);
  };

  const startCounterOffer = (offer: TradeOffer) => {
    setCounterOfferMode(offer.id);
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
    <div className="rounded-lg p-6" style={{ backgroundColor: colors.paper1, border: `2px solid ${colors.rule}` }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: colors.ink }}>
          <Users className="w-5 h-5" />
          Negotiation Phase
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: colors.inkSecondary }}>
            {gameState.negotiation.playersReady.length}/{gameState.players.length} ready
          </span>
          {!isReady ? (
            <button
              onClick={onReady}
              className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              style={{ backgroundColor: colors.success, color: '#fff', border: `2px solid ${colors.rule}` }}
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark Ready
            </button>
          ) : (
            <span className="px-4 py-2 rounded-lg font-medium flex items-center gap-2" style={{ backgroundColor: colors.paper3, color: colors.success, border: `1px solid ${colors.rule}` }}>
              <Check className="w-4 h-4" />
              Ready!
            </span>
          )}
        </div>
      </div>

      {/* Incoming offers */}
      {offersToMe.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium text-sm mb-2" style={{ color: colors.inkSecondary }}>Incoming Offers</h4>
          <div className="space-y-3">
            {offersToMe.map(offer => {
              const fromPlayer = gameState.players.find(p => p.id === offer.fromPlayerId);
              const isCountering = counterOfferMode === offer.id;

              return (
                <div key={offer.id} className="p-4 rounded-lg" style={{ backgroundColor: colors.paper2, border: `2px solid ${colors.rule}` }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 rounded-full" style={{ backgroundColor: fromPlayer?.color }} />
                      <div className="w-6 h-6 rounded-full" style={{ backgroundColor: fromPlayer?.color }} />
                      <span className="font-medium" style={{ color: colors.ink }}>{fromPlayer?.name}</span>
                      <span className="text-sm" style={{ color: colors.inkSecondary }}>offers:</span>
                    </div>
                    {!isCountering && (
                      <div className="flex gap-2">
                        <button onClick={() => onRespond(offer.id, true)} className="px-3 py-1 rounded-lg text-sm flex items-center gap-1" style={{ backgroundColor: colors.success, color: '#fff', border: `1px solid ${colors.rule}` }}>
                          <Check className="w-4 h-4" /> Accept
                        </button>
                        <button onClick={() => startCounterOffer(offer)} className="px-3 py-1 rounded-lg text-sm flex items-center gap-1" style={{ backgroundColor: colors.warning, color: '#fff', border: `1px solid ${colors.rule}` }}>
                          <RefreshCw className="w-4 h-4" /> Counter
                        </button>
                        <button onClick={() => onRespond(offer.id, false)} className="px-3 py-1 rounded-lg text-sm flex items-center gap-1" style={{ backgroundColor: colors.error, color: '#fff', border: `1px solid ${colors.rule}` }}>
                          <X className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}
                  </div>

                  {!isCountering ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs mb-1" style={{ color: colors.inkSecondary }}>They offer ({offer.offeredCardIds.length}):</div>
                        <div className="space-y-1">
                          {offer.offeredCardIds.map(cardId => {
                            const handCard = fromPlayer?.hand.find(h => h.card.id === cardId);
                            return handCard ? <DetailedMiniCard key={cardId} card={handCard.card} /> : <div key={cardId} className="text-xs" style={{ color: colors.inkSecondary }}>Unknown card</div>;
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs mb-1" style={{ color: colors.inkSecondary }}>They want ({offer.requestedCardIds.length}):</div>
                        <div className="space-y-1">
                          {offer.requestedCardIds.map(cardId => {
                            const handCard = currentPlayer?.hand.find(h => h.card.id === cardId);
                            return handCard ? <DetailedMiniCard key={cardId} card={handCard.card} showFull /> : <div key={cardId} className="text-xs" style={{ color: colors.inkSecondary }}>Card not in hand</div>;
                          })}
                          {offer.requestedCardIds.length === 0 && <div className="text-xs italic" style={{ color: colors.inkSecondary }}>Nothing requested</div>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${colors.rule}` }}>
                      <div className="text-sm font-medium mb-2 flex items-center gap-1" style={{ color: colors.warning }}>
                        <RefreshCw className="w-4 h-4" />
                        Make Counter-Offer
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <div className="text-xs mb-1" style={{ color: colors.inkSecondary }}>Your cards to offer ({counterOffered.length}):</div>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {currentPlayer?.hand.map(handCard => (
                              <SelectableDetailedCard key={handCard.card.id} handCard={handCard} selected={counterOffered.includes(handCard.card.id)} onClick={() => toggleCard(handCard.card.id, counterOffered, setCounterOffered)} />
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs mb-1" style={{ color: colors.inkSecondary }}>Cards you want ({counterRequested.length}):</div>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {fromPlayer?.hand.map(handCard => (
                              <SelectableDetailedCard key={handCard.card.id} handCard={handCard} selected={counterRequested.includes(handCard.card.id)} onClick={() => toggleCard(handCard.card.id, counterRequested, setCounterRequested)} showFull />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => handleSubmitCounterOffer(offer)} disabled={counterOffered.length === 0} className="flex-1 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1" style={{ backgroundColor: counterOffered.length > 0 ? colors.ink : colors.paper3, color: counterOffered.length > 0 ? colors.paper1 : colors.inkSecondary, border: `1px solid ${colors.rule}` }}>
                          <Send className="w-4 h-4" />
                          Send Counter-Offer
                        </button>
                        <button onClick={() => { setCounterOfferMode(null); setCounterOffered([]); setCounterRequested([]); }} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: colors.paper3, color: colors.ink, border: `1px solid ${colors.rule}` }}>
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
          <h4 className="font-medium text-sm mb-2" style={{ color: colors.inkSecondary }}>Your Pending Offers</h4>
          <div className="space-y-2">
            {myOffers.map(offer => {
              const toPlayer = gameState.players.find(p => p.id === offer.toPlayerId);
              return (
                <div key={offer.id} className="p-3 rounded-lg flex items-center justify-between" style={{ backgroundColor: colors.paper2, border: `1px solid ${colors.rule}` }}>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" style={{ color: colors.inkSecondary }} />
                    <span className="text-sm" style={{ color: colors.ink }}>
                      Offer to <strong>{toPlayer?.name}</strong>: {offer.offeredCardIds.length} card(s)
                    </span>
                  </div>
                  <button onClick={() => onCancel(offer.id)} className="text-sm" style={{ color: colors.error }}>Cancel</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Make new offer */}
      {!showOfferBuilder ? (
        <button onClick={() => setShowOfferBuilder(true)} className="w-full py-3 rounded-lg transition-colors" style={{ border: `2px dashed ${colors.inkSecondary}`, color: colors.inkSecondary, backgroundColor: 'transparent' }}>
          + Make Trade Offer
        </button>
      ) : (
        <div className="rounded-lg p-4" style={{ backgroundColor: colors.paper2, border: `2px solid ${colors.rule}` }}>
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium" style={{ color: colors.ink }}>New Trade Offer</h4>
            <button onClick={() => { setShowOfferBuilder(false); setSelectedPlayer(null); setOfferedCards([]); setRequestedCards([]); }} style={{ color: colors.inkSecondary }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-4">
            <label className="text-sm block mb-2" style={{ color: colors.inkSecondary }}>Trade with:</label>
            <div className="flex gap-2 flex-wrap">
              {otherPlayers.map(player => (
                <button key={player.id} onClick={() => setSelectedPlayer(player.id)} className="px-3 py-2 rounded-lg flex items-center gap-2 transition-all" style={{ backgroundColor: selectedPlayer === player.id ? colors.paper1 : colors.paper3, border: selectedPlayer === player.id ? `2px solid ${colors.ink}` : `1px solid ${colors.rule}` }}>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: player.color }} />
                  <span className="text-sm font-medium" style={{ color: colors.ink }}>{player.name}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedPlayer && currentPlayer && (
            <>
              <div className="mb-4">
                <label className="text-sm block mb-2" style={{ color: colors.inkSecondary }}>Your cards to offer ({offeredCards.length} selected):</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {currentPlayer.hand.map(handCard => (
                    <SelectableDetailedCard key={handCard.card.id} handCard={handCard} selected={offeredCards.includes(handCard.card.id)} onClick={() => toggleCard(handCard.card.id, offeredCards, setOfferedCards)} showFull />
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm block mb-2" style={{ color: colors.inkSecondary }}>Cards you want ({requestedCards.length} selected):</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {targetPlayer?.hand.map(handCard => (
                    <SelectableDetailedCard key={handCard.card.id} handCard={handCard} selected={requestedCards.includes(handCard.card.id)} onClick={() => toggleCard(handCard.card.id, requestedCards, setRequestedCards)} showFull />
                  ))}
                </div>
              </div>

              <button onClick={handleSubmitOffer} disabled={offeredCards.length === 0} className="w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors" style={{ backgroundColor: offeredCards.length > 0 ? colors.ink : colors.paper3, color: offeredCards.length > 0 ? colors.paper1 : colors.inkSecondary, border: `2px solid ${colors.rule}` }}>
                <Send className="w-4 h-4" />
                Send Offer
              </button>
            </>
          )}
        </div>
      )}

      {/* Your hand with full details */}
      <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${colors.rule}` }}>
        <h4 className="font-medium text-sm mb-2" style={{ color: colors.inkSecondary }}>Your Cards ({currentPlayer?.hand.length})</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {currentPlayer?.hand.map(handCard => (
            <FullCardDisplay key={handCard.card.id} handCard={handCard} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailedMiniCard({ card, showFull }: { card: CampaignCard | PolicyCard; showFull?: boolean }) {
  const isCampaign = 'seatDelta' in card;
  const hasStances = 'stanceTable' in card && card.stanceTable;

  return (
    <div className="p-2 rounded-lg text-xs" style={{ backgroundColor: colors.paper1, border: `1px solid ${colors.rule}` }}>
      <div className="font-medium" style={{ color: colors.ink }}>{card.name}</div>
      {isCampaign && <div style={{ color: colors.success }}>+{(card as CampaignCard).seatDelta} seats</div>}
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
  const color = stance === 'favoured' ? colors.success : stance === 'opposed' ? colors.error : colors.inkSecondary;
  return (
    <div className="flex justify-between">
      <span style={{ color: colors.inkSecondary }}>{label}:</span>
      <span style={{ color }}>{stance === 'favoured' ? 'F' : stance === 'opposed' ? 'O' : 'N'}</span>
    </div>
  );
}

function SelectableDetailedCard({ handCard, selected, onClick, showFull }: { handCard: HandCard; selected: boolean; onClick: () => void; showFull?: boolean }) {
  const { card, isNew } = handCard;
  const isCampaign = 'seatDelta' in card;
  const hasStances = 'stanceTable' in card && card.stanceTable;

  return (
    <div onClick={onClick} className="p-2 rounded-lg cursor-pointer transition-all text-xs" style={{ backgroundColor: selected ? colors.paper3 : colors.paper1, border: selected ? `2px solid ${colors.ink}` : `1px solid ${colors.rule}`, boxShadow: isNew ? `0 0 0 2px ${colors.warning}` : undefined }}>
      <div className="flex items-start justify-between gap-1">
        <span className="px-1 py-0.5 rounded-lg text-[10px]" style={{ backgroundColor: colors.paper2, color: colors.ink, border: `1px solid ${colors.rule}` }}>
          {isCampaign ? 'C' : 'P'}
        </span>
        {isNew && <span className="text-[10px]" style={{ color: colors.warning }}>NEW</span>}
        {selected && <Check className="w-3 h-3" style={{ color: colors.ink }} />}
      </div>

      <div className="font-medium mt-1" style={{ color: colors.ink }}>{card.name}</div>
      {isCampaign && <div className="font-medium" style={{ color: colors.success }}>+{(card as CampaignCard).seatDelta}</div>}

      {showFull && hasStances && (
        <div className="mt-1 pt-1 grid grid-cols-2 gap-x-1 text-[10px]" style={{ borderTop: `1px solid ${colors.paper3}` }}>
          <StanceRow label="Prog" stance={card.stanceTable!.progressive} />
          <StanceRow label="Cons" stance={card.stanceTable!.conservative} />
          <StanceRow label="Mrkt" stance={card.stanceTable!.market} />
          <StanceRow label="Intv" stance={card.stanceTable!.interventionist} />
        </div>
      )}
    </div>
  );
}

function FullCardDisplay({ handCard }: { handCard: HandCard }) {
  const { card, isNew } = handCard;
  const isCampaign = 'seatDelta' in card;
  const hasStances = 'stanceTable' in card && card.stanceTable;
  const hasPolicyLink = isCampaign && (card as CampaignCard).policyLink;

  return (
    <div className="p-3 rounded-lg" style={{ backgroundColor: isNew ? colors.paper3 : colors.paper2, border: `1px solid ${colors.rule}`, boxShadow: isNew ? `0 0 0 2px ${colors.warning}` : undefined }}>
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs px-2 py-0.5 rounded-lg" style={{ backgroundColor: colors.paper1, color: colors.ink, border: `1px solid ${colors.rule}` }}>
          {isCampaign ? 'Campaign' : 'Policy'}
        </span>
        {isNew && <span className="text-xs font-medium" style={{ color: colors.warning }}>NEW</span>}
      </div>

      <div className="font-medium text-sm" style={{ color: colors.ink }}>{card.name}</div>
      <div className="text-xs mt-0.5" style={{ color: colors.inkSecondary }}>{card.description}</div>

      {isCampaign && <div className="text-sm font-bold mt-1" style={{ color: colors.success }}>+{(card as CampaignCard).seatDelta} seats</div>}
      {hasPolicyLink && <div className="text-xs mt-1" style={{ color: colors.ink }}>Links to policy (synergy bonus if passed)</div>}

      {hasStances && (
        <div className="mt-2 pt-2 grid grid-cols-2 gap-1 text-xs" style={{ borderTop: `1px solid ${colors.paper3}` }}>
          <div className="flex justify-between"><span style={{ color: colors.inkSecondary }}>Progressive:</span><span style={{ color: card.stanceTable!.progressive === 'favoured' ? colors.success : card.stanceTable!.progressive === 'opposed' ? colors.error : colors.inkSecondary }}>{card.stanceTable!.progressive}</span></div>
          <div className="flex justify-between"><span style={{ color: colors.inkSecondary }}>Conservative:</span><span style={{ color: card.stanceTable!.conservative === 'favoured' ? colors.success : card.stanceTable!.conservative === 'opposed' ? colors.error : colors.inkSecondary }}>{card.stanceTable!.conservative}</span></div>
          <div className="flex justify-between"><span style={{ color: colors.inkSecondary }}>Market:</span><span style={{ color: card.stanceTable!.market === 'favoured' ? colors.success : card.stanceTable!.market === 'opposed' ? colors.error : colors.inkSecondary }}>{card.stanceTable!.market}</span></div>
          <div className="flex justify-between"><span style={{ color: colors.inkSecondary }}>Interventionist:</span><span style={{ color: card.stanceTable!.interventionist === 'favoured' ? colors.success : card.stanceTable!.interventionist === 'opposed' ? colors.error : colors.inkSecondary }}>{card.stanceTable!.interventionist}</span></div>
        </div>
      )}
    </div>
  );
}
