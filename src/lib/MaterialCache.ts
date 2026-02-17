"use client";

import * as THREE from "three";

const __DEV__ = process.env.NODE_ENV !== 'production';

// ═══════════════════════════════════════════════════════════════════════════════
// MATERIAL CACHE - Reduce shader compilation and VRAM usage
// ═══════════════════════════════════════════════════════════════════════════════
//
// PROBLEM: Each unique material triggers shader compilation on first use.
// WebGL has limited shader program slots (~16-64 on mobile).
// Reusing materials = fewer shader variants = faster scene loading.
//
// STRATEGY:
// - Pool materials by key (e.g., "planet-gas-giant", "ring-ice")
// - Share materials across similar objects
// - Track usage count for smart disposal
//
// ═══════════════════════════════════════════════════════════════════════════════

export type MaterialType =
    | 'standard'
    | 'physical'
    | 'basic'
    | 'shader'
    | 'points';

interface CachedMaterial {
    key: string;
    material: THREE.Material;
    type: MaterialType;
    useCount: number;
    createdAt: number;
    lastUsed: number;
}

interface MaterialConfig {
    color?: THREE.ColorRepresentation;
    roughness?: number;
    metalness?: number;
    envMapIntensity?: number;
    transparent?: boolean;
    opacity?: number;
    side?: THREE.Side;
    depthWrite?: boolean;
    depthTest?: boolean;
    blending?: THREE.Blending;
    map?: THREE.Texture | null;
    normalMap?: THREE.Texture | null;
    emissive?: THREE.ColorRepresentation;
    emissiveIntensity?: number;
}

class MaterialCacheClass {
    private cache = new Map<string, CachedMaterial>();
    private maxCacheSize = 50; // Max materials to keep pooled

    // ═══════════════════════════════════════════════════════════════════════════
    // PRESET MATERIALS - Shared across similar objects
    // ═══════════════════════════════════════════════════════════════════════════

    private presets = new Map<string, MaterialConfig>([
        // Gas giant bodies
        ['planet-gas-giant', {
            roughness: 0.75,
            metalness: 0.05,
            envMapIntensity: 0.8,
        }],
        // Ice rings (Saturn, Neptune)
        ['ring-ice', {
            roughness: 0.08,
            metalness: 0.9,
            envMapIntensity: 5.0,
            transparent: true,
            depthWrite: true,
        }],
        // Rocky planets (Earth, Venus)
        ['planet-rocky', {
            roughness: 0.6,
            metalness: 0.1,
            envMapIntensity: 1.0,
        }],
        // Atmospheric glow (additive)
        ['atmosphere', {
            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        }],
        // Starfield background
        ['starfield', {
            side: THREE.BackSide,
            depthWrite: false,
            depthTest: false,
        }],
    ]);

    /**
     * Get or create a MeshStandardMaterial with the given config.
     * Materials are pooled by key.
     */
    getStandard(key: string, config: MaterialConfig = {}): THREE.MeshStandardMaterial {
        const cached = this.cache.get(key);
        if (cached && cached.type === 'standard') {
            cached.useCount++;
            cached.lastUsed = performance.now();
            return cached.material as THREE.MeshStandardMaterial;
        }

        // Apply preset if exists
        const preset = this.presets.get(key) || {};
        const mergedConfig = { ...preset, ...config };

        const material = new THREE.MeshStandardMaterial({
            color: mergedConfig.color ?? 0xffffff,
            roughness: mergedConfig.roughness ?? 0.5,
            metalness: mergedConfig.metalness ?? 0.0,
            envMapIntensity: mergedConfig.envMapIntensity ?? 1.0,
            transparent: mergedConfig.transparent ?? false,
            opacity: mergedConfig.opacity ?? 1.0,
            side: mergedConfig.side ?? THREE.FrontSide,
            depthWrite: mergedConfig.depthWrite ?? true,
            depthTest: mergedConfig.depthTest ?? true,
        });

        if (mergedConfig.map) material.map = mergedConfig.map;
        if (mergedConfig.normalMap) material.normalMap = mergedConfig.normalMap;
        if (mergedConfig.emissive) {
            material.emissive = new THREE.Color(mergedConfig.emissive);
            material.emissiveIntensity = mergedConfig.emissiveIntensity ?? 1.0;
        }

        this.addToCache(key, material, 'standard');
        return material;
    }

    /**
     * Get or create a MeshPhysicalMaterial with the given config.
     */
    getPhysical(key: string, config: MaterialConfig & {
        clearcoat?: number;
        clearcoatRoughness?: number;
        sheen?: number;
        sheenRoughness?: number;
        sheenColor?: THREE.ColorRepresentation;
    } = {}): THREE.MeshPhysicalMaterial {
        const cached = this.cache.get(key);
        if (cached && cached.type === 'physical') {
            cached.useCount++;
            cached.lastUsed = performance.now();
            return cached.material as THREE.MeshPhysicalMaterial;
        }

        const preset = this.presets.get(key) || {};
        const mergedConfig = { ...preset, ...config };

        const material = new THREE.MeshPhysicalMaterial({
            color: mergedConfig.color ?? 0xffffff,
            roughness: mergedConfig.roughness ?? 0.5,
            metalness: mergedConfig.metalness ?? 0.0,
            envMapIntensity: mergedConfig.envMapIntensity ?? 1.0,
            transparent: mergedConfig.transparent ?? false,
            opacity: mergedConfig.opacity ?? 1.0,
            side: mergedConfig.side ?? THREE.FrontSide,
            depthWrite: mergedConfig.depthWrite ?? true,
            clearcoat: config.clearcoat ?? 0,
            clearcoatRoughness: config.clearcoatRoughness ?? 0,
            sheen: config.sheen ?? 0,
            sheenRoughness: config.sheenRoughness ?? 0.5,
            sheenColor: config.sheenColor ? new THREE.Color(config.sheenColor) : new THREE.Color(0xffffff),
        });

        this.addToCache(key, material, 'physical');
        return material;
    }

    /**
     * Get or create a MeshBasicMaterial.
     */
    getBasic(key: string, config: MaterialConfig = {}): THREE.MeshBasicMaterial {
        const cached = this.cache.get(key);
        if (cached && cached.type === 'basic') {
            cached.useCount++;
            cached.lastUsed = performance.now();
            return cached.material as THREE.MeshBasicMaterial;
        }

        const preset = this.presets.get(key) || {};
        const mergedConfig = { ...preset, ...config };

        const material = new THREE.MeshBasicMaterial({
            color: mergedConfig.color ?? 0xffffff,
            transparent: mergedConfig.transparent ?? false,
            opacity: mergedConfig.opacity ?? 1.0,
            side: mergedConfig.side ?? THREE.FrontSide,
            depthWrite: mergedConfig.depthWrite ?? true,
            depthTest: mergedConfig.depthTest ?? true,
        });

        if (mergedConfig.map) material.map = mergedConfig.map;

        this.addToCache(key, material, 'basic');
        return material;
    }

    /**
     * Store a custom shader material.
     */
    setShader(key: string, material: THREE.ShaderMaterial): void {
        this.addToCache(key, material, 'shader');
    }

    /**
     * Get a previously stored shader material.
     */
    getShader(key: string): THREE.ShaderMaterial | null {
        const cached = this.cache.get(key);
        if (cached && cached.type === 'shader') {
            cached.useCount++;
            cached.lastUsed = performance.now();
            return cached.material as THREE.ShaderMaterial;
        }
        return null;
    }

    /**
     * Check if material exists in cache.
     */
    has(key: string): boolean {
        return this.cache.has(key);
    }

    /**
     * Release a material (decrement use count).
     * Material is kept in pool for potential reuse.
     */
    release(key: string): void {
        const cached = this.cache.get(key);
        if (cached) {
            cached.useCount = Math.max(0, cached.useCount - 1);
        }
    }

    /**
     * Get cache statistics.
     */
    getStats() {
        let totalUses = 0;
        let shaderCount = 0;
        for (const entry of this.cache.values()) {
            totalUses += entry.useCount;
            if (entry.type === 'shader') shaderCount++;
        }
        return {
            materialsPooled: this.cache.size,
            totalActiveUses: totalUses,
            shaderVariants: shaderCount,
            standardVariants: this.cache.size - shaderCount,
        };
    }

    /**
     * Clear unused materials (useCount === 0).
     */
    prune(): number {
        let pruned = 0;
        for (const [key, entry] of this.cache) {
            if (entry.useCount === 0) {
                entry.material.dispose();
                this.cache.delete(key);
                pruned++;
            }
        }
        if (pruned > 0) {
            if (__DEV__) console.log(`[MaterialCache] Pruned ${pruned} unused materials`);
        }
        return pruned;
    }

    /**
     * Force clear all materials.
     */
    clear(): void {
        for (const entry of this.cache.values()) {
            entry.material.dispose();
        }
        this.cache.clear();
        if (__DEV__) console.log('[MaterialCache] Cleared all materials');
    }

    private addToCache(key: string, material: THREE.Material, type: MaterialType): void {
        // Enforce max cache size
        if (this.cache.size >= this.maxCacheSize) {
            this.evictLRU();
        }

        this.cache.set(key, {
            key,
            material,
            type,
            useCount: 1,
            createdAt: performance.now(),
            lastUsed: performance.now(),
        });

        if (__DEV__) console.log(`[MaterialCache] Created: ${key} (${type})`);
    }

    private evictLRU(): void {
        let oldest: CachedMaterial | null = null;
        let oldestTime = Infinity;

        for (const entry of this.cache.values()) {
            // Only evict materials with useCount === 0
            if (entry.useCount === 0 && entry.lastUsed < oldestTime) {
                oldestTime = entry.lastUsed;
                oldest = entry;
            }
        }

        if (oldest) {
            oldest.material.dispose();
            this.cache.delete(oldest.key);
            if (__DEV__) console.log(`[MaterialCache] Evicted LRU: ${oldest.key}`);
        }
    }
}

// Singleton export
export const MaterialCache = new MaterialCacheClass();
