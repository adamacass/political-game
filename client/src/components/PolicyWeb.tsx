import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type {
  PolicySlider,
  StatDefinition,
  ActiveSituation,
  VoterGroupState,
  PolicyCategory,
} from '../types';

// =====================================================
// Props
// =====================================================

interface PolicyWebProps {
  policies: Record<string, PolicySlider>;
  stats: Record<string, StatDefinition>;
  situations: ActiveSituation[];
  voterGroups: VoterGroupState[];
  isGovernment: boolean;
  onPolicyAdjust?: (policyId: string, newValue: number) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

// =====================================================
// Internal types
// =====================================================

type WebNodeType = 'policy' | 'stat' | 'situation' | 'voter_group';

interface WebNode {
  id: string;
  type: WebNodeType;
  name: string;
  icon: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  value: number;
  delta: number;
  pulse: boolean;
}

interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  multiplier: number;
}

// =====================================================
// Constants
// =====================================================

const CW = 1600;
const CH = 1000;

const CAT_COLORS: Record<PolicyCategory, string> = {
  tax: '#e74c3c',
  economy: '#f39c12',
  welfare: '#9b59b6',
  health: '#e91e63',
  education: '#3498db',
  law_order: '#95a5a6',
  infrastructure: '#e67e22',
  environment: '#2ecc71',
  foreign: '#1abc9c',
  immigration: '#8e44ad',
  housing: '#d35400',
  digital: '#2980b9',
  agriculture: '#27ae60',
};

const SEV_COLORS: Record<string, string> = {
  crisis: '#e74c3c',
  problem: '#e67e22',
  neutral: '#7f8c8d',
  good: '#2ecc71',
  boom: '#f1c40f',
};

const BG = '#0f0f23';
const BG2 = '#1a1a3e';
const PBG = '#161630';
const PBORDER = '#2a2a5e';
const T1 = '#e0e0f0';
const T2 = '#8888aa';
const T3 = '#555577';

const CAT_ORDER: PolicyCategory[] = [
  'tax', 'economy', 'welfare', 'health', 'education',
  'law_order', 'infrastructure', 'environment', 'foreign',
  'immigration', 'housing', 'digital', 'agriculture',
];

// =====================================================
// Helpers
// =====================================================

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp(t, 0, 1);
}

function lerpHex(h1: string, h2: string, t: number): string {
  const c = clamp(t, 0, 1);
  const parse = (h: string, o: number) => parseInt(h.slice(o, o + 2), 16);
  const r = Math.round(lerp(parse(h1, 1), parse(h2, 1), c));
  const g = Math.round(lerp(parse(h1, 3), parse(h2, 3), c));
  const b = Math.round(lerp(parse(h1, 5), parse(h2, 5), c));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function statColor(value: number, isGood: boolean): string {
  const t = isGood ? value : 1 - value;
  return t < 0.5
    ? lerpHex('#e74c3c', '#f39c12', t * 2)
    : lerpHex('#f39c12', '#2ecc71', (t - 0.5) * 2);
}

function voterColor(happiness: number): string {
  const t = (happiness + 1) / 2;
  return t < 0.5
    ? lerpHex('#e74c3c', '#f39c12', t * 2)
    : lerpHex('#f39c12', '#2ecc71', (t - 0.5) * 2);
}

function fmtStat(v: number, fmt: string, lo: number, hi: number): string {
  const r = lo + v * (hi - lo);
  switch (fmt) {
    case 'percent': return `${r.toFixed(1)}%`;
    case 'currency': return `$${r.toFixed(0)}B`;
    case 'index': return r.toFixed(2);
    case 'rate': return `${r.toFixed(1)}%`;
    default: return `${(v * 100).toFixed(0)}%`;
  }
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

function curvePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1, dy = y2 - y1;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1) return `M${x1},${y1}L${x2},${y2}`;
  const nx = -dy / d, ny = dx / d;
  const c = clamp(d * 0.08, 5, 35);
  return `M${x1},${y1} Q${(x1 + x2) / 2 + nx * c},${(y1 + y2) / 2 + ny * c} ${x2},${y2}`;
}

// =====================================================
// Layout
// =====================================================

function computeLayout(
  policies: Record<string, PolicySlider>,
  stats: Record<string, StatDefinition>,
  situations: ActiveSituation[],
  voterGroups: VoterGroupState[],
) {
  const nodes = new Map<string, WebNode>();
  const conns: Connection[] = [];

  // --- Policies: arc on the left, sorted by category ---
  const pArr = Object.values(policies).sort(
    (a, b) => CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category),
  );
  const pCx = 280, pCy = 430;

  pArr.forEach((p, i) => {
    const n = pArr.length;
    const angle = n <= 1
      ? -Math.PI / 2
      : ((i / (n - 1)) * Math.PI * 1.6) - Math.PI * 0.8;
    const ring = i % 3;
    const r = 180 + ring * 55;
    const x = clamp(pCx + Math.cos(angle) * r * 0.6, 55, 530);
    const y = clamp(pCy + Math.sin(angle) * r * 0.72, 65, 790);
    const color = CAT_COLORS[p.category] || '#666';

    nodes.set(p.id, {
      id: p.id, type: 'policy',
      name: p.shortName || p.name, icon: p.icon,
      x, y,
      radius: lerp(20, 30, p.currentValue),
      color, value: p.currentValue,
      delta: p.targetValue - p.currentValue,
      pulse: Math.abs(p.targetValue - p.currentValue) > 0.05,
    });

    for (const e of p.effects) {
      conns.push({ id: `${p.id}>${e.targetId}`, sourceId: p.id, targetId: e.targetId, multiplier: e.multiplier });
    }
  });

  // --- Stats: circle in the center ---
  const sArr = Object.values(stats);
  const sCx = 830, sCy = 400;

  sArr.forEach((s, i) => {
    const angle = sArr.length <= 1
      ? 0
      : (i / sArr.length) * Math.PI * 2 - Math.PI / 2;
    const ring = i % 3;
    const r = 90 + ring * 70;
    const x = clamp(sCx + Math.cos(angle) * r, 580, 1060);
    const y = clamp(sCy + Math.sin(angle) * r * 0.85, 70, 740);
    const col = statColor(s.value, s.isGood);

    nodes.set(s.id, {
      id: s.id, type: 'stat',
      name: s.name, icon: s.icon,
      x, y,
      radius: lerp(18, 26, 0.4 + s.value * 0.6),
      color: col, value: s.value,
      delta: s.value - s.prevValue,
      pulse: false,
    });

    for (const e of s.effects) {
      conns.push({ id: `${s.id}>${e.targetId}`, sourceId: s.id, targetId: e.targetId, multiplier: e.multiplier });
    }
  });

  // --- Situations: right column ---
  const sitCx = 1320, sitCy = 380;

  situations.forEach((s, i) => {
    const n = situations.length;
    const angle = n <= 1 ? 0 : ((i / (n - 1)) * Math.PI) - Math.PI / 2;
    const r = 100 + i * 25;
    const x = clamp(sitCx + Math.cos(angle) * r * 0.35, 1120, CW - 60);
    const y = clamp(sitCy + Math.sin(angle) * r, 70, 700);
    const col = SEV_COLORS[s.severityType] || '#666';

    nodes.set(s.definitionId, {
      id: s.definitionId, type: 'situation',
      name: s.name, icon: s.icon,
      x, y,
      radius: lerp(24, 36, s.severity),
      color: col, value: s.severity,
      delta: 0,
      pulse: s.severityType === 'crisis' || s.severityType === 'boom',
    });
  });

  // --- Voter groups: bottom row ---
  const vgY = 885;
  const vgN = voterGroups.length;
  const vgSpread = Math.min(1100, vgN * 150);
  const vgX0 = (CW - vgSpread) / 2;

  voterGroups.forEach((vg, i) => {
    const x = vgN <= 1 ? CW / 2 : vgX0 + (i / (vgN - 1)) * vgSpread;
    const y = vgY + (i % 2) * 45;
    const col = voterColor(vg.happiness);

    nodes.set(vg.id, {
      id: vg.id, type: 'voter_group',
      name: vg.name, icon: vg.icon,
      x: clamp(x, 100, CW - 100), y,
      radius: lerp(26, 36, clamp(vg.population / 25, 0, 1)),
      color: col, value: (vg.happiness + 1) / 2,
      delta: vg.happiness - vg.prevHappiness,
      pulse: vg.happiness < -0.7,
    });
  });

  return { nodes, connections: conns.filter(c => nodes.has(c.sourceId) && nodes.has(c.targetId)) };
}

// =====================================================
// Arrowhead
// =====================================================

function Arrowhead({ x1, y1, x2, y2, color, opacity, tr }: {
  x1: number; y1: number; x2: number; y2: number;
  color: string; opacity: number; tr: number;
}) {
  const dx = x2 - x1, dy = y2 - y1;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1) return null;
  const nx = dx / d, ny = dy / d;
  const ax = x2 - nx * (tr + 5), ay = y2 - ny * (tr + 5);
  const sz = 6, px = -ny, py = nx;
  const pts = [
    `${ax},${ay}`,
    `${ax - nx * sz + px * sz * 0.5},${ay - ny * sz + py * sz * 0.5}`,
    `${ax - nx * sz - px * sz * 0.5},${ay - ny * sz - py * sz * 0.5}`,
  ].join(' ');
  return <polygon points={pts} fill={color} opacity={opacity} />;
}

// =====================================================
// Main Component
// =====================================================

export function PolicyWeb({
  policies, stats, situations, voterGroups,
  isGovernment, onPolicyAdjust,
  selectedNodeId, onSelectNode,
}: PolicyWebProps) {

  // State
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hovId, setHovId] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [sliderVal, setSliderVal] = useState(0);

  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomR = useRef(zoom);
  const panXR = useRef(panX);
  const panYR = useRef(panY);

  useEffect(() => { zoomR.current = zoom; }, [zoom]);
  useEffect(() => { panXR.current = panX; }, [panX]);
  useEffect(() => { panYR.current = panY; }, [panY]);

  // Layout
  const { nodes, connections } = useMemo(
    () => computeLayout(policies, stats, situations, voterGroups),
    [policies, stats, situations, voterGroups],
  );
  const nodeArr = useMemo(() => Array.from(nodes.values()), [nodes]);
  const selNode = selectedNodeId ? nodes.get(selectedNodeId) ?? null : null;

  // Active connections (connected to selected/hovered node)
  const activeId = selectedNodeId ?? hovId;
  const activeConns = useMemo(() => {
    if (!activeId) return new Set<string>();
    return new Set(
      connections
        .filter(c => c.sourceId === activeId || c.targetId === activeId)
        .map(c => c.id),
    );
  }, [activeId, connections]);

  // Connected node IDs for dimming
  const connectedIds = useMemo(() => {
    if (!activeId) return new Set<string>();
    const s = new Set<string>();
    s.add(activeId);
    connections.forEach(c => {
      if (c.sourceId === activeId) s.add(c.targetId);
      if (c.targetId === activeId) s.add(c.sourceId);
    });
    return s;
  }, [activeId, connections]);

  // Reset slider on policy select
  useEffect(() => {
    if (selectedNodeId && policies[selectedNodeId]) {
      setSliderVal(policies[selectedNodeId].targetValue);
    }
  }, [selectedNodeId, policies]);

  // Wheel zoom (passive: false)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.12 : 0.89;
      const oz = zoomR.current;
      const nz = clamp(oz * f, 0.3, 4);
      const rect = svg.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * CW;
      const my = ((e.clientY - rect.top) / rect.height) * CH;
      const cx = (mx - panXR.current) / oz;
      const cy = (my - panYR.current) / oz;
      setPanX(mx - cx * nz);
      setPanY(my - cy * nz);
      setZoom(nz);
    };
    svg.addEventListener('wheel', handler, { passive: false });
    return () => svg.removeEventListener('wheel', handler);
  }, []);

  // Pan handlers
  const onDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as SVGElement).closest('[data-nid]')) return;
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setPanStart({ x: panX, y: panY });
  }, [panX, panY]);

  const onMove = useCallback((e: React.MouseEvent) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (rect) setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (dragging) {
      const rect2 = svgRef.current?.getBoundingClientRect();
      if (rect2) {
        setPanX(panStart.x + (e.clientX - dragStart.x) * (CW / rect2.width));
        setPanY(panStart.y + (e.clientY - dragStart.y) * (CH / rect2.height));
      }
    }
  }, [dragging, dragStart, panStart]);

  const onUp = useCallback(() => setDragging(false), []);

  const clickBg = useCallback((e: React.MouseEvent) => {
    if (!(e.target as SVGElement).closest('[data-nid]')) onSelectNode(null);
  }, [onSelectNode]);

  const clickNode = useCallback((id: string) => {
    onSelectNode(selectedNodeId === id ? null : id);
  }, [selectedNodeId, onSelectNode]);

  const confirmPolicy = useCallback(() => {
    if (selectedNodeId && onPolicyAdjust) onPolicyAdjust(selectedNodeId, sliderVal);
  }, [selectedNodeId, sliderVal, onPolicyAdjust]);

  // Helper to resolve a node name from its ID
  const nodeName = useCallback((id: string): string => {
    const n = nodes.get(id);
    if (n) return n.name;
    if (policies[id]) return policies[id].shortName || policies[id].name;
    if (stats[id]) return stats[id].name;
    return id;
  }, [nodes, policies, stats]);

  const nodeIcon = useCallback((id: string): string => {
    return nodes.get(id)?.icon || '?';
  }, [nodes]);

  // =====================================================
  // Detail panel renderers
  // =====================================================

  const renderEffects = (title: string, list: Connection[], side: 'source' | 'target') => {
    if (list.length === 0) return null;
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={labelStyle}>{title}</div>
        {list.map(c => {
          const oid = side === 'target' ? c.targetId : c.sourceId;
          return (
            <div
              key={c.id}
              onClick={() => onSelectNode(oid)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 11, padding: '3px 6px', borderRadius: 4,
                cursor: 'pointer', marginBottom: 2,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 14 }}>{nodeIcon(oid)}</span>
              <span style={{ color: T2, flex: 1 }}>{nodeName(oid)}</span>
              <span style={{
                color: c.multiplier >= 0 ? '#2ecc71' : '#e74c3c',
                fontWeight: 'bold', minWidth: 40, textAlign: 'right',
              }}>
                {c.multiplier >= 0 ? '+' : ''}{(c.multiplier * 100).toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const policyDetail = (id: string, incoming: Connection[], outgoing: Connection[]) => {
    const p = policies[id];
    if (!p) return null;
    const changed = Math.abs(sliderVal - p.targetValue) > 0.005;
    const curCost = p.costPerPoint * p.currentValue;
    const newCost = p.costPerPoint * sliderVal;

    return (
      <>
        <div style={{ fontSize: 12, color: T2, marginBottom: 12, lineHeight: 1.5 }}>{p.description}</div>

        {/* Current value bar */}
        <div style={{ marginBottom: 14 }}>
          <div style={rowBetween}><span style={dimSm}>Current</span><span style={dimSm}>{fmtPct(p.currentValue)}</span></div>
          <div style={barTrack}>
            <div style={{ ...barFill, width: `${p.currentValue * 100}%`, background: CAT_COLORS[p.category] }} />
          </div>
          <div style={rowBetween}><span style={dimXs}>{p.minLabel}</span><span style={dimXs}>{p.maxLabel}</span></div>
        </div>

        {Math.abs(p.targetValue - p.currentValue) > 0.005 && (
          <div style={{ fontSize: 11, color: '#f39c12', marginBottom: 8 }}>
            Target: {fmtPct(p.targetValue)} (delay: {p.implementationDelay} rounds)
          </div>
        )}

        {/* Slider (government only) */}
        {isGovernment && onPolicyAdjust && (
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${PBORDER}`,
            borderRadius: 8, padding: 12, marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#f1c40f' }}>ADJUST POLICY</div>
            <div style={rowBetween}>
              <span style={dimSm}>Proposed</span>
              <span style={{ fontSize: 11, color: T1, fontWeight: 'bold' }}>{fmtPct(sliderVal)}</span>
            </div>
            <input
              type="range" min={0} max={100} step={1}
              value={Math.round(sliderVal * 100)}
              onChange={e => setSliderVal(Number(e.target.value) / 100)}
              style={{ width: '100%', accentColor: CAT_COLORS[p.category], marginBottom: 8 }}
            />
            <div style={rowBetween}><span style={dimXs}>{p.minLabel}</span><span style={dimXs}>{p.maxLabel}</span></div>

            <div style={{ fontSize: 11, color: T2, marginTop: 6 }}>
              Annual cost: <span style={{ color: newCost > curCost ? '#e74c3c' : '#2ecc71' }}>
                ${newCost.toFixed(1)}B
              </span>
              {Math.abs(newCost - curCost) > 0.05 && (
                <span style={{ color: T3 }}> (was ${curCost.toFixed(1)}B)</span>
              )}
            </div>

            {changed && outgoing.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={labelStyle}>PROJECTED EFFECTS</div>
                {outgoing.slice(0, 8).map(c => {
                  const d = c.multiplier * (sliderVal - p.currentValue);
                  return (
                    <div key={c.id} style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ color: T2 }}>{nodeName(c.targetId)}</span>
                      <span style={{ color: d >= 0 ? '#2ecc71' : '#e74c3c', fontWeight: 'bold' }}>
                        {d >= 0 ? '+' : ''}{(d * 100).toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={confirmPolicy}
              disabled={!changed}
              style={{
                width: '100%', marginTop: 10, padding: '8px 0',
                background: changed ? CAT_COLORS[p.category] : '#333',
                color: changed ? '#fff' : '#666',
                border: 'none', borderRadius: 4,
                fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold',
                cursor: changed ? 'pointer' : 'default', letterSpacing: 1,
              }}
            >CONFIRM CHANGE</button>
          </div>
        )}

        {renderEffects('AFFECTS', outgoing, 'target')}
        {renderEffects('AFFECTED BY', incoming, 'source')}
      </>
    );
  };

  const statDetail = (id: string, incoming: Connection[], outgoing: Connection[]) => {
    const s = stats[id];
    if (!s) return null;
    const disp = fmtStat(s.value, s.displayFormat, s.displayMin, s.displayMax);
    const d = s.value - s.prevValue;

    return (
      <>
        <div style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 4, color: selNode?.color || T1 }}>{disp}</div>
        <div style={{ fontSize: 13, marginBottom: 16 }}>
          {d !== 0 ? (
            <span style={{ color: (d > 0) === s.isGood ? '#2ecc71' : '#e74c3c' }}>
              {d > 0 ? '+' : ''}{(d * 100).toFixed(1)}% {d > 0 ? '▲' : '▼'}
            </span>
          ) : <span style={{ color: T3 }}>No change</span>}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ ...barTrack, height: 8, position: 'relative' }}>
            <div style={{
              ...barFill, height: 8, borderRadius: 4,
              width: `${s.value * 100}%`,
              background: `linear-gradient(90deg, ${statColor(0, s.isGood)}, ${statColor(s.value, s.isGood)})`,
            }} />
            <div style={{
              position: 'absolute', left: `${s.prevValue * 100}%`, top: 0,
              width: 2, height: '100%', background: 'rgba(255,255,255,0.35)',
            }} />
          </div>
        </div>

        {renderEffects('AFFECTED BY', incoming, 'source')}
        {renderEffects('AFFECTS', outgoing, 'target')}
      </>
    );
  };

  const situationDetail = (id: string, incoming: Connection[], outgoing: Connection[]) => {
    const sit = situations.find(s => s.definitionId === id);
    if (!sit) return null;
    const sc = SEV_COLORS[sit.severityType] || '#666';

    return (
      <>
        <div style={{
          fontSize: 12, padding: '5px 10px', display: 'inline-block', marginBottom: 12,
          background: rgba(sc, 0.15), border: `1px solid ${rgba(sc, 0.3)}`,
          borderRadius: 4, color: sc, textTransform: 'uppercase', letterSpacing: 1,
        }}>{sit.severityType}</div>

        <div style={{ fontSize: 13, color: T2, marginBottom: 12, fontStyle: 'italic', lineHeight: 1.5 }}>
          &ldquo;{sit.headline}&rdquo;
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={rowBetween}><span style={dimSm}>Severity</span><span style={dimSm}>{(sit.severity * 100).toFixed(0)}%</span></div>
          <div style={{ ...barTrack, height: 8 }}>
            <div style={{ ...barFill, height: 8, borderRadius: 4, width: `${sit.severity * 100}%`, background: sc }} />
          </div>
        </div>

        <div style={{ fontSize: 11, color: T3, marginBottom: 16 }}>Active since round {sit.roundActivated}</div>

        {renderEffects('CAUSED BY', incoming, 'source')}
        {renderEffects('EFFECTS', outgoing, 'target')}
      </>
    );
  };

  const voterDetail = (id: string, incoming: Connection[]) => {
    const vg = voterGroups.find(v => v.id === id);
    if (!vg) return null;
    const hc = voterColor(vg.happiness);
    const d = vg.happiness - vg.prevHappiness;

    return (
      <>
        {/* Happiness bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={rowBetween}>
            <span style={dimSm}>Happiness</span>
            <span style={{ fontSize: 11, color: hc, fontWeight: 'bold' }}>
              {(vg.happiness * 100).toFixed(0)}%
              {d !== 0 && (
                <span style={{ color: d > 0 ? '#2ecc71' : '#e74c3c', marginLeft: 4 }}>
                  ({d > 0 ? '+' : ''}{(d * 100).toFixed(1)})
                </span>
              )}
            </span>
          </div>
          <div style={{ ...barTrack, height: 10, position: 'relative' }}>
            <div style={{
              position: 'absolute', left: '50%', top: 0, width: 1, height: '100%',
              background: 'rgba(255,255,255,0.15)',
            }} />
            <div style={{
              position: 'absolute',
              left: vg.happiness >= 0 ? '50%' : `${((vg.happiness + 1) / 2) * 100}%`,
              width: `${Math.abs(vg.happiness) * 50}%`,
              height: '100%', background: hc, borderRadius: 5,
              transition: 'all 0.5s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T3, marginTop: 2 }}>
            <span>Furious</span><span>Neutral</span><span>Elated</span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {[
            { val: `${vg.population.toFixed(1)}%`, label: 'Population' },
            { val: `${(vg.turnout * 100).toFixed(0)}%`, label: 'Turnout' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 6,
              padding: 8, textAlign: 'center',
            }}>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: T1 }}>{s.val}</div>
              <div style={{ fontSize: 10, color: T3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Loyalty */}
        {Object.keys(vg.loyalty).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>LOYALTY</div>
            {Object.entries(vg.loyalty).map(([pid, val]) => (
              <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: T2 }}>{pid}</span>
                <span style={{ color: val > 0 ? '#2ecc71' : val < 0 ? '#e74c3c' : T3 }}>
                  {val > 0 ? '+' : ''}{(val * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {renderEffects('INFLUENCED BY', incoming, 'source')}
      </>
    );
  };

  // =====================================================
  // Render
  // =====================================================

  const incoming = useMemo(
    () => selectedNodeId ? connections.filter(c => c.targetId === selectedNodeId) : [],
    [selectedNodeId, connections],
  );
  const outgoing = useMemo(
    () => selectedNodeId ? connections.filter(c => c.sourceId === selectedNodeId) : [],
    [selectedNodeId, connections],
  );

  return (
    <div
      ref={boxRef}
      style={{
        position: 'relative', width: '100%', height: '100%',
        background: BG, overflow: 'hidden',
        cursor: dragging ? 'grabbing' : 'default',
        userSelect: 'none', fontFamily: 'monospace',
      }}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
    >
      {/* ===== SVG Canvas ===== */}
      <svg
        ref={svgRef}
        width="100%" height="100%"
        viewBox={`0 0 ${CW} ${CH}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={onDown}
        onClick={clickBg}
        style={{ display: 'block' }}
      >
        <defs>
          <radialGradient id="pw-bg" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor={BG2} />
            <stop offset="100%" stopColor={BG} />
          </radialGradient>
          <filter id="pw-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
            <feComposite in="b" in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="pw-lglow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="pw-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
          </filter>
          <pattern id="pw-dots" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="0.7" fill="rgba(255,255,255,0.06)" />
          </pattern>
        </defs>

        {/* Background */}
        <rect width={CW} height={CH} fill="url(#pw-bg)" />
        <rect width={CW} height={CH} fill="url(#pw-dots)" />

        {/* Transform group */}
        <g transform={`translate(${panX},${panY}) scale(${zoom})`}>

          {/* Zone backgrounds */}
          <rect x={40} y={30} width={520} height={790} rx={16}
            fill="rgba(255,255,255,0.012)" stroke="rgba(255,255,255,0.025)" strokeWidth={1} />
          <rect x={570} y={30} width={510} height={730} rx={16}
            fill="rgba(255,255,255,0.012)" stroke="rgba(255,255,255,0.025)" strokeWidth={1} />
          <rect x={1090} y={30} width={470} height={730} rx={16}
            fill="rgba(255,255,255,0.012)" stroke="rgba(255,255,255,0.025)" strokeWidth={1} />
          <rect x={100} y={830} width={1400} height={140} rx={16}
            fill="rgba(255,255,255,0.012)" stroke="rgba(255,255,255,0.025)" strokeWidth={1} />

          {/* Zone labels */}
          {[
            { x: 300, y: 55, t: 'POLICIES' },
            { x: 825, y: 55, t: 'STATISTICS' },
            { x: 1325, y: 55, t: 'SITUATIONS' },
            { x: 800, y: 855, t: 'ELECTORATE' },
          ].map(z => (
            <text key={z.t} x={z.x} y={z.y} textAnchor="middle"
              fontSize={13} fill="rgba(255,255,255,0.12)"
              fontFamily="monospace" letterSpacing={6}
            >{z.t}</text>
          ))}

          {/* ===== Connections ===== */}
          {connections.map(c => {
            const src = nodes.get(c.sourceId);
            const tgt = nodes.get(c.targetId);
            if (!src || !tgt) return null;
            const active = activeConns.has(c.id);
            const pos = c.multiplier >= 0;
            const str = Math.abs(c.multiplier);
            const col = pos ? '#2ecc71' : '#e74c3c';
            const op = active ? 0.7 : (activeId ? 0.03 : 0.1);
            const sw = active ? lerp(1.5, 4, str) : lerp(0.4, 1.8, str);
            const path = curvePath(src.x, src.y, tgt.x, tgt.y);

            return (
              <g key={c.id}>
                {active && (
                  <path d={path} fill="none" stroke={col}
                    strokeWidth={sw + 4} opacity={0.2} filter="url(#pw-lglow)" />
                )}
                <path d={path} fill="none" stroke={col}
                  strokeWidth={sw} opacity={op} strokeLinecap="round"
                  style={{ transition: 'opacity 0.3s, stroke-width 0.3s' }}
                />
                {active && (
                  <Arrowhead x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    color={col} opacity={0.6} tr={tgt.radius} />
                )}
              </g>
            );
          })}

          {/* ===== Nodes ===== */}
          {nodeArr.map(nd => {
            const isSel = nd.id === selectedNodeId;
            const isHov = nd.id === hovId;
            const dimmed = activeId != null && !connectedIds.has(nd.id);
            const circ = 2 * Math.PI * (nd.radius - 4);

            return (
              <g
                key={nd.id} data-nid={nd.id}
                onClick={e => { e.stopPropagation(); clickNode(nd.id); }}
                onMouseEnter={() => setHovId(nd.id)}
                onMouseLeave={() => setHovId(null)}
                style={{ cursor: 'pointer' }}
                opacity={dimmed ? 0.25 : 1}
              >
                {/* Pulse ring */}
                {nd.pulse && (
                  <circle cx={nd.x} cy={nd.y} r={nd.radius + 4}
                    fill="none" stroke={nd.color} strokeWidth={1.5}>
                    <animate attributeName="r"
                      values={`${nd.radius + 2};${nd.radius + 14};${nd.radius + 2}`}
                      dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity"
                      values="0.5;0;0.5" dur="2.5s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Selection ring */}
                {isSel && (
                  <circle cx={nd.x} cy={nd.y} r={nd.radius + 6}
                    fill="none" stroke="#fff" strokeWidth={2}
                    strokeDasharray="4 3" opacity={0.8}>
                    <animateTransform attributeName="transform" type="rotate"
                      from={`0 ${nd.x} ${nd.y}`} to={`360 ${nd.x} ${nd.y}`}
                      dur="8s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Hover glow */}
                {(isHov || isSel) && (
                  <circle cx={nd.x} cy={nd.y} r={nd.radius + 8}
                    fill={rgba(nd.color, 0.15)} filter="url(#pw-glow)" />
                )}

                {/* Main circle */}
                <circle cx={nd.x} cy={nd.y} r={nd.radius}
                  fill={rgba(nd.color, 0.18)}
                  stroke={nd.color}
                  strokeWidth={isSel ? 2.5 : isHov ? 2 : 1.5}
                  filter="url(#pw-shadow)"
                />

                {/* Value ring (policies and stats) */}
                {(nd.type === 'policy' || nd.type === 'stat') && nd.radius > 8 && (
                  <circle cx={nd.x} cy={nd.y} r={nd.radius - 4}
                    fill="none"
                    stroke={rgba(nd.color, 0.4)}
                    strokeWidth={3}
                    strokeDasharray={`${nd.value * circ} ${circ}`}
                    transform={`rotate(-90 ${nd.x} ${nd.y})`}
                    strokeLinecap="round"
                  />
                )}

                {/* Voter group happiness arc */}
                {nd.type === 'voter_group' && (
                  <circle cx={nd.x} cy={nd.y} r={nd.radius - 4}
                    fill="none"
                    stroke={rgba(nd.color, 0.4)}
                    strokeWidth={3}
                    strokeDasharray={`${nd.value * 2 * Math.PI * (nd.radius - 4)} ${2 * Math.PI * (nd.radius - 4)}`}
                    transform={`rotate(-90 ${nd.x} ${nd.y})`}
                    strokeLinecap="round"
                  />
                )}

                {/* Icon */}
                <text x={nd.x} y={nd.y + 1} textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={nd.radius * 0.8}
                  style={{ pointerEvents: 'none' }}
                >{nd.icon}</text>

                {/* Name */}
                <text x={nd.x} y={nd.y + nd.radius + 13} textAnchor="middle"
                  fontSize={9.5} fill={T2} fontFamily="monospace"
                  style={{ pointerEvents: 'none' }}
                >{nd.name.length > 14 ? nd.name.slice(0, 12) + '..' : nd.name}</text>

                {/* Delta arrow */}
                {Math.abs(nd.delta) > 0.005 && (
                  <text
                    x={nd.x + nd.radius + 2} y={nd.y - nd.radius + 6}
                    fontSize={11} fontWeight="bold" fontFamily="monospace"
                    fill={nd.delta > 0 ? '#2ecc71' : '#e74c3c'}
                    style={{ pointerEvents: 'none' }}
                  >{nd.delta > 0 ? '▲' : '▼'}</text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* ===== Zoom Controls ===== */}
      <div style={{
        position: 'absolute', bottom: 16,
        right: selectedNodeId ? 380 : 16,
        display: 'flex', flexDirection: 'column', gap: 4,
        transition: 'right 0.3s', zIndex: 15,
      }}>
        {[
          { label: '+', fn: () => setZoom(z => clamp(z * 1.25, 0.3, 4)) },
          { label: '\u2013', fn: () => setZoom(z => clamp(z / 1.25, 0.3, 4)) },
          { label: '\u25cb', fn: () => { setZoom(1); setPanX(0); setPanY(0); } },
        ].map(b => (
          <button key={b.label} onClick={b.fn} style={zoomBtnStyle}>{b.label}</button>
        ))}
        <div style={{ fontSize: 9, color: T3, textAlign: 'center', fontFamily: 'monospace' }}>
          {(zoom * 100).toFixed(0)}%
        </div>
      </div>

      {/* ===== Tooltip ===== */}
      {hovId && hovId !== selectedNodeId && (() => {
        const nd = nodes.get(hovId);
        if (!nd) return null;

        let valueText = '';
        if (nd.type === 'policy') valueText = fmtPct(nd.value);
        else if (nd.type === 'stat') {
          const s = stats[nd.id];
          valueText = s ? fmtStat(s.value, s.displayFormat, s.displayMin, s.displayMax) : fmtPct(nd.value);
        } else if (nd.type === 'situation') valueText = `Severity: ${(nd.value * 100).toFixed(0)}%`;
        else if (nd.type === 'voter_group') {
          const vg = voterGroups.find(v => v.id === nd.id);
          valueText = vg ? `Happiness: ${(vg.happiness * 100).toFixed(0)}%` : '';
        }

        return (
          <div style={{
            position: 'absolute', left: mouse.x + 16, top: mouse.y - 10,
            background: 'rgba(12,12,30,0.94)', border: `1px solid ${PBORDER}`,
            borderRadius: 6, padding: '6px 10px',
            fontFamily: 'monospace', fontSize: 12, color: T1,
            pointerEvents: 'none', zIndex: 30, whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>{nd.icon}</span>
              <span style={{ fontWeight: 'bold' }}>{nd.name}</span>
            </div>
            <div style={{ fontSize: 11, color: nd.color, marginTop: 2 }}>
              {valueText}
              {Math.abs(nd.delta) > 0.005 && (
                <span style={{ color: nd.delta > 0 ? '#2ecc71' : '#e74c3c', marginLeft: 6 }}>
                  {nd.delta > 0 ? '▲' : '▼'}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* ===== Detail Panel ===== */}
      {selNode && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: 360, height: '100%',
          background: `linear-gradient(180deg, ${PBG} 0%, ${BG} 100%)`,
          borderLeft: `1px solid ${PBORDER}`,
          padding: 20, boxSizing: 'border-box',
          overflowY: 'auto', fontFamily: 'monospace', color: T1,
          zIndex: 20, backdropFilter: 'blur(8px)',
        }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button onClick={() => onSelectNode(null)} style={{
            position: 'absolute', top: 10, right: 10,
            background: 'transparent', border: `1px solid ${T3}`,
            color: T2, fontSize: 14, cursor: 'pointer',
            width: 26, height: 26, display: 'flex',
            alignItems: 'center', justifyContent: 'center', borderRadius: 4,
          }}>x</button>

          {/* Header */}
          <div style={{ fontSize: 32, marginBottom: 4 }}>{selNode.icon}</div>
          <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 2 }}>{selNode.name}</div>
          <div style={{
            fontSize: 11, color: T3, textTransform: 'uppercase',
            letterSpacing: 2, marginBottom: 16,
          }}>{selNode.type.replace('_', ' ')}</div>
          <div style={{ height: 1, background: PBORDER, marginBottom: 16 }} />

          {selNode.type === 'policy' && policyDetail(selNode.id, incoming, outgoing)}
          {selNode.type === 'stat' && statDetail(selNode.id, incoming, outgoing)}
          {selNode.type === 'situation' && situationDetail(selNode.id, incoming, outgoing)}
          {selNode.type === 'voter_group' && voterDetail(selNode.id, incoming)}
        </div>
      )}

      {/* ===== Category Legend (bottom-left) ===== */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        display: 'flex', flexWrap: 'wrap', gap: '3px 10px',
        maxWidth: 360, zIndex: 10,
      }}>
        {CAT_ORDER.map(cat => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: CAT_COLORS[cat], flexShrink: 0,
            }} />
            <span style={{
              fontSize: 9, color: T3, fontFamily: 'monospace',
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>{cat.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// Shared inline style fragments
// =====================================================

const rowBetween: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', marginBottom: 4,
};

const dimSm: React.CSSProperties = { fontSize: 11, color: T3 };
const dimXs: React.CSSProperties = { fontSize: 10, color: T3 };

const barTrack: React.CSSProperties = {
  height: 6, background: '#222244', borderRadius: 3, overflow: 'hidden',
};

const barFill: React.CSSProperties = {
  height: '100%', borderRadius: 3, transition: 'width 0.4s',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10, color: T3, textTransform: 'uppercase',
  letterSpacing: 2, marginBottom: 6,
};

const zoomBtnStyle: React.CSSProperties = {
  width: 32, height: 32,
  background: 'rgba(20,20,50,0.85)',
  border: `1px solid ${PBORDER}`,
  color: T2, fontSize: 16, fontFamily: 'monospace',
  cursor: 'pointer', borderRadius: 4,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backdropFilter: 'blur(4px)',
};
