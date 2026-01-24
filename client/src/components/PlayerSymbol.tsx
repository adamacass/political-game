/**
 * PlayerSymbol Component
 *
 * Renders a player's political symbol inside a colored circle.
 * Used in the lobby, leaderboard, map badges, and other player identity displays.
 */

import React from 'react';
import * as LucideIcons from 'lucide-react';
import { getSymbolById, DEFAULT_SYMBOL_ID } from '../constants/politicalSymbols';

// Design tokens - ballot paper aesthetic
const colors = {
  paper1: '#F4F1E8',
  rule: '#1A1A1A',
};

interface PlayerSymbolProps {
  symbolId: string;
  color: string;          // Party color (hex)
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showBorder?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { container: 'w-6 h-6', icon: 12 },
  md: { container: 'w-8 h-8', icon: 16 },
  lg: { container: 'w-10 h-10', icon: 20 },
  xl: { container: 'w-14 h-14', icon: 28 },
};

export function PlayerSymbol({
  symbolId,
  color,
  size = 'md',
  showBorder = true,
  className = '',
}: PlayerSymbolProps) {
  const symbol = getSymbolById(symbolId) || getSymbolById(DEFAULT_SYMBOL_ID);
  const { container, icon } = sizeMap[size];

  // Dynamically get the icon component from lucide-react
  const IconComponent = (LucideIcons as any)[symbol?.icon || 'Landmark'];

  return (
    <div
      className={`${container} rounded-full flex items-center justify-center ${className}`}
      style={{
        backgroundColor: color,
        border: showBorder ? `2px solid ${colors.rule}` : undefined,
      }}
    >
      {IconComponent && (
        <IconComponent
          size={icon}
          color={colors.paper1}
          strokeWidth={2}
        />
      )}
    </div>
  );
}

/**
 * Symbol picker grid for lobby
 */
interface SymbolPickerProps {
  selectedId: string;
  onSelect: (id: string) => void;
  previewColor: string;
}

export function SymbolPicker({ selectedId, onSelect, previewColor }: SymbolPickerProps) {
  // Import all symbols
  const { POLITICAL_SYMBOLS } = require('../constants/politicalSymbols');

  return (
    <div className="grid grid-cols-10 gap-1">
      {POLITICAL_SYMBOLS.map((symbol: any) => {
        const IconComponent = (LucideIcons as any)[symbol.icon];
        const isSelected = selectedId === symbol.id;

        return (
          <button
            key={symbol.id}
            onClick={() => onSelect(symbol.id)}
            className={`w-8 h-8 rounded flex items-center justify-center transition-all ${
              isSelected
                ? 'ring-2 ring-offset-1 scale-110'
                : 'hover:scale-105 hover:bg-opacity-80'
            }`}
            style={{
              backgroundColor: isSelected ? previewColor : colors.paper1,
              border: `1px solid ${colors.rule}`,
              '--tw-ring-color': colors.rule,
            } as any}
            title={symbol.name}
          >
            {IconComponent && (
              <IconComponent
                size={16}
                color={isSelected ? colors.paper1 : colors.rule}
                strokeWidth={2}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
