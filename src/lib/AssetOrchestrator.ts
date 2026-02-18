"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET ORCHESTRATOR v2.0 - Elite Frame-Budgeted Streaming System
//
// ARCHITECTURE OVERHAUL:
// - Frame-budgeted scheduler (no more setTimeout loops fighting the render loop)
// - Object Pooling with soft disposal (geometry stays in pool, GC pressure eliminated)
// - Hysteresis-aware priority system
// - Predictive velocity-based preloading
// - Dynamic VRAM budgeting per performance tier
// - Zero jank guarantee under normal operation
//
// KEY INSIGHT: The orchestrator no longer drives its own loop.
// Instead, Experience.tsx calls `tick()` once per frame inside useFrame.
// This ensures ALL work is synchronized with the render loop.
// ═══════════════════════════════════════════════════════════════════════════════

const __DEV__ = process.env.NODE_ENV !== 'production';

export type AssetPriority = 'critical' | 'high' | 'normal' | 'idle';
export type AssetStatus = 'pending' | 'loading' | 'ready' | 'error' | 'pooled';
export type ChapterStatus = 'pending' | 'streaming' | 'buffered' | 'evicted';
export type SchedulerJobType = 'load' | 'priority' | 'evict' | 'lod' | 'idle';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface AssetEntry {
    key: string;
    type: 'glb' | 'texture' | 'hdr';
    size: number;
    lastUsed: number;
    data: any;
    dispose: () => void;
    chapterId: string | null;
    pooled: boolean; // Soft disposal - geometry hidden but not destroyed
}

interface PreloadTask {
    key: string;
    priority: AssetPriority;
    priorityValue: number;
    loader: () => Promise<any>;
    estimatedSize: number;
    chapterId: string | null;
    queuedAt: number; // For starvation prevention
}

interface ChapterAssetDef {
    key: string;
    loader: () => Promise<any>;
    size: number;
    type: AssetEntry['type'];
    dispose: () => void;
}

export interface StreamResult<T> {
    data: T | null;
    status: AssetStatus;
    progress: number;
    error?: Error;
}

type StreamCallback<T> = (result: StreamResult<T>) => void;

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const PRIORITY_VALUES: Record<AssetPriority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    idle: 3,
};

// Frame budget allocation (in milliseconds)
const FRAME_BUDGET_MS = 3; // Max time per frame for background work

// VRAM budgets per tier (bytes)
const VRAM_BUDGETS: Record<number, number> = {
    0: 150 * 1024 * 1024,   // 150MB - Mobile survival mode
    1: 300 * 1024 * 1024,   // 300MB - Low-end desktop
    2: 800 * 1024 * 1024,   // 800MB - Mid-range
    3: 1536 * 1024 * 1024,  // 1.5GB - High-end
};

// Pool configuration
const POOL_MAX_SIZE = 50 * 1024 * 1024; // Keep up to 50MB in pool for instant recall

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER - Round-Robin Job System
// ═══════════════════════════════════════════════════════════════════════════════

class SchedulerClass {
    private jobQueue: SchedulerJobType[] = ['load', 'priority', 'evict', 'lod'];
    private currentJobIndex = 0;
    private frameCount = 0;

    // Camera tracking for smart priority checks
    private lastCameraPosition = { x: 0, y: 0, z: 0 };
    private cameraMovedThisFrame = false;
    private cameraMovementThreshold = 1; // Only check priorities if camera moved > 1 unit

    /**
     * Get the next job type to execute this frame.
     * Uses round-robin to distribute work evenly.
     */
    getNextJobType(): SchedulerJobType {
        const job = this.jobQueue[this.currentJobIndex];
        this.currentJobIndex = (this.currentJobIndex + 1) % this.jobQueue.length;
        this.frameCount++;
        return job;
    }

    /**
     * Check if camera has moved enough to warrant priority recalculation.
     */
    updateCameraPosition(x: number, y: number, z: number): boolean {
        const dx = x - this.lastCameraPosition.x;
        const dy = y - this.lastCameraPosition.y;
        const dz = z - this.lastCameraPosition.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        this.cameraMovedThisFrame = distance > this.cameraMovementThreshold;

        if (this.cameraMovedThisFrame) {
            this.lastCameraPosition = { x, y, z };
        }

        return this.cameraMovedThisFrame;
    }

    shouldCheckPriorities(): boolean {
        return this.cameraMovedThisFrame;
    }

    getFrameCount(): number {
        return this.frameCount;
    }
}

export const Scheduler = new SchedulerClass();

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET POOL - Soft Disposal System
// ═══════════════════════════════════════════════════════════════════════════════

class AssetPoolClass {
    private pool = new Map<string, AssetEntry>();
    private poolSize = 0;
    private maxPoolSize = POOL_MAX_SIZE;

    /**
     * Move asset to pool instead of disposing.
     * Asset stays in memory but is marked as "pooled" (invisible).
     */
    add(entry: AssetEntry): boolean {
        // If pool is full, actually dispose the oldest entry
        if (this.poolSize + entry.size > this.maxPoolSize) {
            this.evictOldest();
        }

        // Still too big? Hard dispose instead
        if (this.poolSize + entry.size > this.maxPoolSize) {
            return false; // Signal caller to hard dispose
        }

        entry.pooled = true;
        entry.lastUsed = performance.now();
        this.pool.set(entry.key, entry);
        this.poolSize += entry.size;

        if (__DEV__) console.log(`[AssetPool] Pooled: ${entry.key} (${(entry.size / 1024 / 1024).toFixed(1)}MB)`);
        return true;
    }

    /**
     * Retrieve asset from pool (instant "load").
     */
    retrieve(key: string): AssetEntry | null {
        const entry = this.pool.get(key);
        if (entry) {
            this.pool.delete(key);
            this.poolSize -= entry.size;
            entry.pooled = false;
            entry.lastUsed = performance.now();
            if (__DEV__) console.log(`[AssetPool] Retrieved from pool: ${key}`);
            return entry;
        }
        return null;
    }

    has(key: string): boolean {
        return this.pool.has(key);
    }

    private evictOldest(): void {
        let oldest: AssetEntry | null = null;
        let oldestTime = Infinity;

        for (const entry of this.pool.values()) {
            if (entry.lastUsed < oldestTime) {
                oldestTime = entry.lastUsed;
                oldest = entry;
            }
        }

        if (oldest) {
            if (__DEV__) console.log(`[AssetPool] Hard disposing from pool: ${oldest.key}`);
            oldest.dispose();
            this.pool.delete(oldest.key);
            this.poolSize -= oldest.size;
        }
    }

    getStats() {
        return {
            count: this.pool.size,
            size: this.poolSize,
            maxSize: this.maxPoolSize,
        };
    }

    /**
     * Force clear pool (for memory pressure situations)
     */
    clear(): void {
        for (const entry of this.pool.values()) {
            entry.dispose();
        }
        this.pool.clear();
        this.poolSize = 0;
        if (__DEV__) console.log('[AssetPool] Cleared');
    }
}

export const AssetPool = new AssetPoolClass();

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class AssetOrchestratorClass {
    private cache = new Map<string, AssetEntry>();
    private memoryBudget = VRAM_BUDGETS[2]; // Default to mid-tier
    private currentUsage = 0;
    private preloadQueue: PreloadTask[] = [];
    private activeLoads = new Map<string, Promise<void>>(); // Track in-flight loads

    // Chapter management
    private chapterAssets = new Map<string, Set<string>>();
    private chapterStatus = new Map<string, ChapterStatus>();
    private currentChapterId: string = 'scene1';

    // Stream subscriptions
    private streamCallbacks = new Map<string, Set<StreamCallback<any>>>();
    private loadingStatus = new Map<string, AssetStatus>();
    private loadingProgress = new Map<string, number>();

    // Performance tier
    private currentTier: number = 2;

    // Predictive loading
    private scrollVelocity: number = 0;
    private currentScrollPosition: number = 0;

    // ───────────────────────────────────────────────────────────────────────────
    // FRAME-BUDGETED TICK - Called once per frame from useFrame
    // ───────────────────────────────────────────────────────────────────────────

    /**
     * Process one job per frame, staying within budget.
     * Called from Experience.tsx inside useFrame.
     */
    tick(delta: number, cameraPosition?: { x: number; y: number; z: number }): void {
        // Early exit if no budget left (should not happen as startFrame should be called first)
        if (!FrameBudget.hasTimeLeft()) return;

        // Update camera tracking
        if (cameraPosition) {
            Scheduler.updateCameraPosition(cameraPosition.x, cameraPosition.y, cameraPosition.z);
        }

        // Get next job type (round-robin)
        const jobType = Scheduler.getNextJobType();

        // Execute job within budget with early-exit
        switch (jobType) {
            case 'load':
                if (FrameBudget.hasTimeLeft()) this.tickLoad();
                break;
            case 'priority':
                if (Scheduler.shouldCheckPriorities() && FrameBudget.hasTimeLeft()) {
                    this.tickPriority();
                }
                break;
            case 'evict':
                if (FrameBudget.hasTimeLeft()) this.tickEvict();
                break;
            case 'lod':
                if (FrameBudget.hasTimeLeft()) this.tickLOD();
                break;
        }

        // Check budget at end and log if exceeded
        FrameBudget.checkBudget(`tick:${jobType}`);
    }

    private tickLoad(): void {
        // Early exit if budget exceeded
        if (!FrameBudget.hasTimeLeftStrict()) return;
        // Only start one load per frame to avoid overwhelming the main thread
        if (this.activeLoads.size > 2) return; // Max 2 concurrent loads
        if (this.preloadQueue.length === 0) return;

        // Get highest priority task
        const task = this.preloadQueue[0];
        if (!task) return;

        // Skip if already loading or cached
        if (this.activeLoads.has(task.key) || this.cache.has(task.key)) {
            this.preloadQueue.shift();
            return;
        }

        // Check if in pool first (instant load!)
        const pooled = AssetPool.retrieve(task.key);
        if (pooled) {
            this.cache.set(task.key, pooled);
            this.currentUsage += pooled.size;
            this.preloadQueue.shift();
            this.loadingStatus.set(task.key, 'ready');
            this.loadingProgress.set(task.key, 100);
            this.notifyStreamCallbacks(task.key, {
                data: pooled.data,
                status: 'ready',
                progress: 100,
            });
            return;
        }

        // Start async load (non-blocking)
        this.preloadQueue.shift();
        this.loadingStatus.set(task.key, 'loading');
        this.loadingProgress.set(task.key, 10);

        const loadPromise = this.executeLoad(task);
        this.activeLoads.set(task.key, loadPromise);

        loadPromise.finally(() => {
            this.activeLoads.delete(task.key);
            this.updateChapterBufferedStatus();
        });
    }

    private async executeLoad(task: PreloadTask): Promise<void> {
        // Update chapter status
        if (task.chapterId) {
            this.chapterStatus.set(task.chapterId, 'streaming');
        }

        this.notifyStreamCallbacks(task.key, {
            data: null,
            status: 'loading',
            progress: 10,
        });

        try {
            await task.loader();

            // Stats-only preload loaders may not call set().
            // Mark as ready so telemetry can advance.
            if (!this.cache.has(task.key) && !AssetPool.has(task.key)) {
                this.loadingStatus.set(task.key, 'ready');
                this.loadingProgress.set(task.key, 100);
                this.notifyStreamCallbacks(task.key, {
                    data: null,
                    status: 'ready',
                    progress: 100,
                });
            }

            if (__DEV__) console.log(`[AssetOrchestrator] Loaded: ${task.key}`);
        } catch (err) {
            console.warn(`[AssetOrchestrator] Failed: ${task.key}`, err);
            this.loadingStatus.set(task.key, 'error');
            this.notifyStreamCallbacks(task.key, {
                data: null,
                status: 'error',
                progress: 0,
                error: err as Error,
            });
        }
    }

    private tickPriority(): void {
        // Re-sort queue based on current priorities
        // This is now only called when camera has moved significantly
        if (this.preloadQueue.length > 1) {
            this.preloadQueue.sort((a, b) => {
                // Primary: priority value
                if (a.priorityValue !== b.priorityValue) {
                    return a.priorityValue - b.priorityValue;
                }
                // Secondary: starvation prevention (older tasks first)
                return a.queuedAt - b.queuedAt;
            });
        }
    }

    private tickEvict(): void {
        // Early exit if budget exceeded
        if (!FrameBudget.hasTimeLeftStrict()) return;
        // Only evict if over budget
        if (this.currentUsage <= this.memoryBudget) return;

        // Evict ONE asset per frame (spread the work)
        const evictable = this.findEvictableByChapter();
        if (evictable) {
            this.softRemove(evictable.key);
        }
    }

    private tickLOD(): void {
        // Reserved for future LOD state updates
        // This job slot can be used for mesh LOD switching
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Configuration
    // ───────────────────────────────────────────────────────────────────────────

    setTier(tier: 0 | 1 | 2 | 3): void {
        this.currentTier = tier;
        this.memoryBudget = VRAM_BUDGETS[tier];
        if (__DEV__) console.log(`[AssetOrchestrator] Tier ${tier}: VRAM budget ${(this.memoryBudget / 1024 / 1024).toFixed(0)}MB`);
    }

    getTier(): number {
        return this.currentTier;
    }

    setMemoryBudget(bytes: number) {
        this.memoryBudget = bytes;
    }

    getMemoryUsage() {
        const poolStats = AssetPool.getStats();
        return {
            used: this.currentUsage,
            budget: this.memoryBudget,
            percent: Math.round((this.currentUsage / this.memoryBudget) * 100),
            pooled: poolStats.size,
            poolCount: poolStats.count,
        };
    }

    // Predictive loading support
    updateScrollState(position: number, velocity: number): void {
        this.scrollVelocity = velocity;
        this.currentScrollPosition = position;
    }

    getPredictedScrollPosition(lookAheadMs: number = 500): number {
        return this.currentScrollPosition + (this.scrollVelocity * (lookAheadMs / 1000));
    }

    setCurrentChapter(chapterId: string) {
        this.currentChapterId = chapterId;
    }

    getCurrentChapter(): string {
        return this.currentChapterId;
    }

    getChapterStatus(chapterId: string): ChapterStatus {
        return this.chapterStatus.get(chapterId) || 'pending';
    }

    getAllChapterStatuses(): Record<string, ChapterStatus> {
        const result: Record<string, ChapterStatus> = {};
        for (const [id, status] of this.chapterStatus) {
            result[id] = status;
        }
        return result;
    }

    getActivePreloads(): string[] {
        return [...this.activeLoads.keys()];
    }

    getRegisteredAssetKeys(): string[] {
        const keys = new Set<string>();
        for (const chapterKeys of this.chapterAssets.values()) {
            for (const key of chapterKeys) {
                keys.add(key);
            }
        }
        return [...keys];
    }

    getProgressForKey(key: string): number {
        const status = this.getStatus(key);
        if (status === 'ready' || status === 'pooled') return 100;
        if (status === 'error') return 0;
        if (status === 'loading') {
            return Math.max(10, this.loadingProgress.get(key) || 0);
        }
        return this.loadingProgress.get(key) || 0;
    }

    getTotalProgress(keys: string[]): number {
        if (keys.length === 0) return 0;
        const total = keys.reduce((sum, key) => sum + this.getProgressForKey(key), 0);
        return total / keys.length;
    }

    getQueueLength(): number {
        return this.preloadQueue.length;
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Chapter Registration
    // ───────────────────────────────────────────────────────────────────────────

    registerChapterAssets(chapterId: string, assets: ChapterAssetDef[]) {
        if (!this.chapterAssets.has(chapterId)) {
            this.chapterAssets.set(chapterId, new Set());
            this.chapterStatus.set(chapterId, 'pending');
        }

        const chapterKeys = this.chapterAssets.get(chapterId)!;

        for (const asset of assets) {
            chapterKeys.add(asset.key);

            if (this.cache.has(asset.key)) {
                const entry = this.cache.get(asset.key)!;
                entry.chapterId = chapterId;
                continue;
            }

            this.loadingStatus.set(asset.key, 'pending');
            this.loadingProgress.set(asset.key, 0);
        }

        if (__DEV__) console.log(`[AssetOrchestrator] Registered chapter "${chapterId}" with ${assets.length} assets`);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Cache Operations
    // ───────────────────────────────────────────────────────────────────────────

    has(key: string): boolean {
        return this.cache.has(key) || AssetPool.has(key);
    }

    get<T = any>(key: string): T | null {
        // Check active cache first
        const entry = this.cache.get(key);
        if (entry) {
            entry.lastUsed = performance.now();
            return entry.data as T;
        }

        // Check pool (promotes to active cache)
        const pooled = AssetPool.retrieve(key);
        if (pooled) {
            this.cache.set(key, pooled);
            this.currentUsage += pooled.size;
            return pooled.data as T;
        }

        return null;
    }

    getStatus(key: string): AssetStatus {
        if (this.cache.has(key)) return 'ready';
        if (AssetPool.has(key)) return 'pooled';
        return this.loadingStatus.get(key) || 'pending';
    }

    set(
        key: string,
        data: any,
        type: AssetEntry['type'],
        size: number,
        dispose: () => void,
        chapterId: string | null = null
    ) {
        // Evict existing if present
        if (this.cache.has(key)) {
            this.softRemove(key);
        }

        // Enforce VRAM budget before adding
        this.enforceVRAMBudget(size);

        const entry: AssetEntry = {
            key,
            type,
            size,
            lastUsed: performance.now(),
            data,
            dispose,
            chapterId,
            pooled: false,
        };

        this.cache.set(key, entry);
        this.currentUsage += size;

        this.loadingStatus.set(key, 'ready');
        this.loadingProgress.set(key, 100);

        this.notifyStreamCallbacks(key, {
            data,
            status: 'ready',
            progress: 100,
        });

        if (__DEV__) console.log(`[AssetOrchestrator] Cached: ${key} (${(size / 1024 / 1024).toFixed(1)}MB)`);
    }

    /**
     * Soft remove: Move to pool instead of disposing.
     * Asset can be instantly "reloaded" from pool.
     */
    softRemove(key: string): void {
        const entry = this.cache.get(key);
        if (!entry) return;

        this.cache.delete(key);
        this.currentUsage -= entry.size;

        // Try to pool instead of disposing
        const pooled = AssetPool.add(entry);
        if (!pooled) {
            // Pool rejected (full), hard dispose
            entry.dispose();
            this.loadingStatus.delete(key);
            this.loadingProgress.delete(key);
        } else {
            this.loadingStatus.set(key, 'pooled');
        }

        if (__DEV__) console.log(`[AssetOrchestrator] Soft removed: ${key}`);
    }

    /**
     * Hard remove: Actually dispose the asset.
     */
    remove(key: string) {
        const entry = this.cache.get(key);
        if (entry) {
            entry.dispose();
            this.currentUsage -= entry.size;
            this.cache.delete(key);
            this.loadingStatus.delete(key);
            this.loadingProgress.delete(key);
            if (__DEV__) console.log(`[AssetOrchestrator] Hard removed: ${key}`);
        }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Stream API
    // ───────────────────────────────────────────────────────────────────────────

    stream<T = any>(key: string, callback?: StreamCallback<T>): StreamResult<T> {
        if (callback) {
            if (!this.streamCallbacks.has(key)) {
                this.streamCallbacks.set(key, new Set());
            }
            this.streamCallbacks.get(key)!.add(callback);
        }

        // Check active cache
        const cached = this.cache.get(key);
        if (cached) {
            cached.lastUsed = performance.now();
            return {
                data: cached.data as T,
                status: 'ready',
                progress: 100,
            };
        }

        // Check pool
        if (AssetPool.has(key)) {
            return {
                data: null, // Will be retrieved on next tick
                status: 'pooled',
                progress: 100,
            };
        }

        return {
            data: null,
            status: this.loadingStatus.get(key) || 'pending',
            progress: this.loadingProgress.get(key) || 0,
        };
    }

    unsubscribe<T>(key: string, callback: StreamCallback<T>) {
        const callbacks = this.streamCallbacks.get(key);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    private notifyStreamCallbacks<T>(key: string, result: StreamResult<T>) {
        const callbacks = this.streamCallbacks.get(key);
        if (callbacks) {
            for (const cb of callbacks) {
                try {
                    cb(result);
                } catch (e) {
                    console.warn(`[AssetOrchestrator] Stream callback error for ${key}:`, e);
                }
            }
        }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // VRAM Budget Enforcement
    // ───────────────────────────────────────────────────────────────────────────

    private enforceVRAMBudget(requiredSpace: number) {
        let iterations = 0;
        const maxIterations = 10; // Prevent infinite loops

        while (this.currentUsage + requiredSpace > this.memoryBudget &&
            this.cache.size > 0 &&
            iterations < maxIterations) {
            const evictable = this.findEvictableByChapter();
            if (evictable) {
                this.softRemove(evictable.key);
            } else {
                break;
            }
            iterations++;
        }
    }

    private findEvictableByChapter(): AssetEntry | null {
        let oldest: AssetEntry | null = null;
        let oldestTime = Infinity;

        for (const entry of this.cache.values()) {
            // Prefer evicting from non-current chapters
            if (entry.chapterId && entry.chapterId !== this.currentChapterId) {
                if (entry.lastUsed < oldestTime) {
                    oldestTime = entry.lastUsed;
                    oldest = entry;
                }
            }
        }

        // If no non-current chapter assets, fall back to LRU
        if (!oldest) {
            for (const entry of this.cache.values()) {
                if (entry.lastUsed < oldestTime) {
                    oldestTime = entry.lastUsed;
                    oldest = entry;
                }
            }
        }

        return oldest;
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Preload Queue
    // ───────────────────────────────────────────────────────────────────────────

    queuePreload(task: Omit<PreloadTask, 'priorityValue' | 'queuedAt'>) {
        if (this.cache.has(task.key)) return;
        if (AssetPool.has(task.key)) return; // Will be retrieved from pool

        const existing = this.preloadQueue.find(t => t.key === task.key);
        if (existing) {
            const newPriority = PRIORITY_VALUES[task.priority];
            if (newPriority < existing.priorityValue) {
                existing.priority = task.priority;
                existing.priorityValue = newPriority;
                this.preloadQueue.sort((a, b) => a.priorityValue - b.priorityValue);
            }
            return;
        }

        const fullTask: PreloadTask = {
            ...task,
            priorityValue: PRIORITY_VALUES[task.priority],
            queuedAt: performance.now(),
        };

        this.preloadQueue.push(fullTask);
        this.preloadQueue.sort((a, b) => a.priorityValue - b.priorityValue);

        this.loadingStatus.set(task.key, 'pending');
    }

    updatePriority(key: string, priority: AssetPriority) {
        const task = this.preloadQueue.find(t => t.key === key);
        if (task) {
            task.priority = priority;
            task.priorityValue = PRIORITY_VALUES[priority];
            this.preloadQueue.sort((a, b) => a.priorityValue - b.priorityValue);
        }
    }

    private updateChapterBufferedStatus() {
        for (const [chapterId, assetKeys] of this.chapterAssets) {
            let allReady = true;
            for (const key of assetKeys) {
                const status = this.loadingStatus.get(key);
                if (!this.cache.has(key) && !AssetPool.has(key) && status !== 'ready') {
                    allReady = false;
                    break;
                }
            }
            if (allReady && this.chapterStatus.get(chapterId) !== 'evicted') {
                this.chapterStatus.set(chapterId, 'buffered');
            }
        }
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Chapter Disposal
    // ───────────────────────────────────────────────────────────────────────────

    disposeChapter(chapterId: string) {
        const assetKeys = this.chapterAssets.get(chapterId);
        if (!assetKeys) {
            if (__DEV__) console.log(`[AssetOrchestrator] Chapter "${chapterId}" not found`);
            return;
        }

        if (__DEV__) console.log(`[AssetOrchestrator] Disposing chapter "${chapterId}" (${assetKeys.size} assets)`);

        for (const key of assetKeys) {
            if (this.cache.has(key)) {
                this.softRemove(key); // Soft dispose to pool
            }
        }

        this.chapterStatus.set(chapterId, 'evicted');
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Cleanup
    // ───────────────────────────────────────────────────────────────────────────

    disposeAll() {
        for (const entry of this.cache.values()) {
            entry.dispose();
        }
        this.cache.clear();
        this.currentUsage = 0;
        this.preloadQueue = [];
        this.chapterAssets.clear();
        this.chapterStatus.clear();
        this.loadingStatus.clear();
        this.loadingProgress.clear();
        this.streamCallbacks.clear();
        AssetPool.clear();
    }

    disposeByType(type: AssetEntry['type']) {
        for (const [key, entry] of this.cache.entries()) {
            if (entry.type === type) {
                this.softRemove(key);
            }
        }
    }
}

// Singleton instance
export const AssetOrchestrator = new AssetOrchestratorClass();

// ═══════════════════════════════════════════════════════════════════════════════
// FRAME BUDGET TRACKER - Monitor frame time for adaptive quality
// ═══════════════════════════════════════════════════════════════════════════════

class FrameBudgetClass {
    private frameStart = 0;
    private budget = 16.67; // 60fps target (ms)
    private workBudget = 3; // Max ms per frame for background work (tick operations)
    private lastFrameTime = 0;
    private jankCount = 0;
    private readonly jankThreshold = 50; // ms
    private frameHistory: number[] = [];
    private readonly historySize = 60; // Track last 60 frames

    // ═══════════════════════════════════════════════════════════════════════════
    // TELEMETRY - Track budget overruns
    // ═══════════════════════════════════════════════════════════════════════════
    private overrunCount = 0;
    private overrunHistory: number[] = []; // Last N overrun amounts
    private readonly overrunHistorySize = 20;
    private lastOverrunMs = 0;

    startFrame() {
        const now = performance.now();
        const delta = now - this.lastFrameTime;

        // Track frame history for P95 calculation
        this.frameHistory.push(delta);
        if (this.frameHistory.length > this.historySize) {
            this.frameHistory.shift();
        }

        // Detect jank
        if (this.lastFrameTime > 0 && delta > this.jankThreshold) {
            this.jankCount++;
            if (this.jankCount <= 5) {
                console.warn(`[FrameBudget] Jank detected: ${delta.toFixed(1)}ms`);
            }
        }

        this.lastFrameTime = now;
        this.frameStart = now;
    }

    /**
     * Check if there's time left for more work this frame.
     * Uses workBudget (3ms) not full frame budget (16.67ms).
     */
    hasTimeLeft(): boolean {
        return this.elapsedWork() < this.workBudget * 0.8;
    }

    /**
     * Stricter check - stops work earlier to guarantee no overrun.
     */
    hasTimeLeftStrict(): boolean {
        return this.elapsedWork() < this.workBudget * 0.6;
    }

    /**
     * Check budget and log if exceeded - returns false if over budget.
     */
    checkBudget(operationName: string = 'unknown'): boolean {
        const elapsed = this.elapsedWork();
        if (elapsed > this.workBudget) {
            this.overrunCount++;
            this.lastOverrunMs = elapsed - this.workBudget;
            this.overrunHistory.push(this.lastOverrunMs);
            if (this.overrunHistory.length > this.overrunHistorySize) {
                this.overrunHistory.shift();
            }
            // Log first 5 overruns then throttle
            if (this.overrunCount <= 5 || this.overrunCount % 100 === 0) {
                console.warn(`[FrameBudget] Budget overrun in ${operationName}: ${elapsed.toFixed(1)}ms (budget: ${this.workBudget}ms, overrun #${this.overrunCount})`);
            }
            return false;
        }
        return true;
    }

    remaining(): number {
        return Math.max(0, this.workBudget - this.elapsedWork());
    }

    /**
     * Time elapsed since startFrame() for this frame.
     */
    elapsed(): number {
        return performance.now() - this.frameStart;
    }

    /**
     * Alias for elapsed() - work budget tracking.
     */
    elapsedWork(): number {
        return performance.now() - this.frameStart;
    }

    setBudget(targetFps: number) {
        this.budget = 1000 / targetFps;
    }

    setWorkBudget(ms: number) {
        this.workBudget = Math.max(1, Math.min(ms, 8)); // Clamp 1-8ms
    }

    getP95FrameTime(): number {
        if (this.frameHistory.length < 10) return 0;
        const sorted = [...this.frameHistory].sort((a, b) => a - b);
        const p95Index = Math.floor(sorted.length * 0.95);
        return sorted[p95Index];
    }

    getAverageFrameTime(): number {
        if (this.frameHistory.length === 0) return 0;
        return this.frameHistory.reduce((a, b) => a + b, 0) / this.frameHistory.length;
    }

    getStats() {
        return {
            jankCount: this.jankCount,
            lastFrameTime: this.lastFrameTime,
            p95: this.getP95FrameTime(),
            average: this.getAverageFrameTime(),
            overrunCount: this.overrunCount,
            lastOverrunMs: this.lastOverrunMs,
            avgOverrun: this.overrunHistory.length > 0
                ? this.overrunHistory.reduce((a, b) => a + b, 0) / this.overrunHistory.length
                : 0,
        };
    }

    resetJankCount() {
        this.jankCount = 0;
    }

    resetOverrunCount() {
        this.overrunCount = 0;
        this.overrunHistory = [];
        this.lastOverrunMs = 0;
    }
}

// Singleton instance
export const FrameBudget = new FrameBudgetClass();

// ═══════════════════════════════════════════════════════════════════════════════
// IDLE PRELOADER - Load assets during browser idle time
// ═══════════════════════════════════════════════════════════════════════════════

type PreloadCallback = () => void | Promise<void>;

class IdlePreloaderClass {
    private queue: PreloadCallback[] = [];
    private isProcessing = false;

    schedule(callback: PreloadCallback, delayMs = 0): () => void {
        const timeoutId = window.setTimeout(() => {
            this.queue.push(callback);
            this.process();
        }, delayMs);

        return () => window.clearTimeout(timeoutId);
    }

    private process() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;

        const runNext = () => {
            if (this.queue.length === 0) {
                this.isProcessing = false;
                return;
            }

            const callback = this.queue.shift()!;

            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(
                    async (deadline: any) => {
                        if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
                            try {
                                await callback();
                            } catch (e) {
                                console.warn('[IdlePreloader] Error:', e);
                            }
                        } else {
                            this.queue.unshift(callback);
                        }
                        runNext();
                    },
                    { timeout: 3000 }
                );
            } else {
                setTimeout(async () => {
                    try {
                        await callback();
                    } catch (e) {
                        console.warn('[IdlePreloader] Error:', e);
                    }
                    runNext();
                }, 100);
            }
        };

        runNext();
    }
}

// Singleton instance
export const IdlePreloader = new IdlePreloaderClass();


