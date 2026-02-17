"use client";

import { useState } from "react";
import { useDirectorSceneOpacity } from "../lib/useDirector";

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED DEBUG COMPONENTS
// Used by Scene2Planets, Scene3Group, and other debug menus
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Base position interface for planet/object positioning
 */
export interface PlanetPosition {
    x: number;
    y: number;
    z: number;
    scale: number;
    spinSpeed: number;
    rotX: number;
    rotY: number;
    rotZ: number;
}

/**
 * Camera settings interface
 */
export interface CameraSettings {
    x: number;
    y: number;
    z: number;
    fov: number;
}

/**
 * Helper to create default planet position
 */
export const defaultPlanetPosition = (
    x: number, y: number, z: number, scale: number, spin: number = 0
): PlanetPosition => ({
    x, y, z, scale, spinSpeed: spin, rotX: 0, rotY: 0, rotZ: 0
});

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface SliderProps {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step?: number;
}

export function Slider({ label, value, onChange, min, max, step = 1 }: SliderProps) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
            <span style={{ width: '28px', fontSize: '10px' }}>{label}:</span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                style={{ flex: 1, height: '12px' }}
            />
            <input
                type="number"
                value={Math.abs(step) < 1 ? value.toFixed(2) : value.toFixed(0)}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                style={{
                    width: '45px',
                    background: '#222',
                    color: '#fff',
                    border: '1px solid #444',
                    fontSize: '9px',
                    padding: '1px'
                }}
            />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OBJECT SLIDERS - Position/Scale/Rotation bundle
// ═══════════════════════════════════════════════════════════════════════════════

interface ObjectSlidersProps {
    name: string;
    emoji: string;
    pos: PlanetPosition;
    onChange: (p: Partial<PlanetPosition>) => void;
    // Optional range overrides
    posRange?: { min: number; max: number };
    zRange?: { min: number; max: number };
    scaleRange?: { min: number; max: number };
}

export function ObjectSliders({
    name,
    emoji,
    pos,
    onChange,
    posRange = { min: -300, max: 300 },
    zRange = { min: -500, max: 100 },
    scaleRange = { min: 0.5, max: 100 }
}: ObjectSlidersProps) {
    return (
        <div style={{ marginBottom: '8px', padding: '6px', background: '#1a1a1a', borderRadius: '4px' }}>
            <div style={{ color: '#8af', fontSize: '11px', marginBottom: '4px' }}>{emoji} {name}</div>
            <Slider label="X" value={pos.x} onChange={(v) => onChange({ x: v })} min={posRange.min} max={posRange.max} />
            <Slider label="Y" value={pos.y} onChange={(v) => onChange({ y: v })} min={posRange.min} max={posRange.max} />
            <Slider label="Z" value={pos.z} onChange={(v) => onChange({ z: v })} min={zRange.min} max={zRange.max} />
            <Slider label="Size" value={pos.scale} onChange={(v) => onChange({ scale: v })} min={scaleRange.min} max={scaleRange.max} step={0.5} />
            <Slider label="Spin" value={pos.spinSpeed} onChange={(v) => onChange({ spinSpeed: v })} min={0} max={0.5} step={0.01} />
            <div style={{ color: '#fa8', fontSize: '9px', marginTop: '4px' }}>Rotation</div>
            <Slider label="rX" value={pos.rotX} onChange={(v) => onChange({ rotX: v })} min={-180} max={180} step={1} />
            <Slider label="rY" value={pos.rotY} onChange={(v) => onChange({ rotY: v })} min={-180} max={180} step={1} />
            <Slider label="rZ" value={pos.rotZ} onChange={(v) => onChange({ rotZ: v })} min={-180} max={180} step={1} />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEBUG PANEL WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

interface DebugPanelProps {
    title: string;
    showDebug: boolean;
    onToggle: () => void;
    renderContent: () => React.ReactNode;
    buttonLabel: string;
    onCopyValues?: () => void;
}

export function DebugPanel({
    title,
    showDebug,
    onToggle,
    renderContent,
    buttonLabel,
    onCopyValues
}: DebugPanelProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (onCopyValues) {
            onCopyValues();
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!showDebug) {
        return (
            <button onClick={onToggle} style={{
                position: 'fixed', bottom: '10px', right: '10px', zIndex: 9999,
                padding: '6px 12px', background: '#333', color: '#fff', border: 'none',
                borderRadius: '4px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '11px'
            }}>{buttonLabel}</button>
        );
    }

    return (
        <div style={{
            position: 'fixed', bottom: '10px', right: '10px', zIndex: 9999,
            background: 'rgba(0,0,0,0.95)', color: '#fff', padding: '10px',
            borderRadius: '8px', fontFamily: 'monospace', fontSize: '10px',
            width: '300px', maxHeight: '85vh', overflowY: 'auto'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ fontSize: '12px' }}>{title}</strong>
                <div style={{ display: 'flex', gap: '4px' }}>
                    {onCopyValues && (
                        <button onClick={handleCopy} style={{
                            background: copied ? '#4a4' : '#555', border: 'none', color: '#fff',
                            padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px'
                        }}>{copied ? '✓' : '📋'}</button>
                    )}
                    <button onClick={onToggle} style={{
                        background: '#444', border: 'none', color: '#fff',
                        padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px'
                    }}>Hide</button>
                </div>
            </div>
            {renderContent()}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Scene visibility check
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to check if debug menu should be visible based on scene opacity
 */
export function useDebugVisibility(sceneKey: 'spaceOpacity' | 'scene2Opacity' | 'scene3Opacity') {
    const sceneOpacity = useDirectorSceneOpacity();
    return sceneOpacity[sceneKey] > 0.1;
}
