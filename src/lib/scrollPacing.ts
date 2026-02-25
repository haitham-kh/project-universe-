const MIN_FRAME_DELTA_SECONDS = 0.008;
const MAX_FRAME_DELTA_SECONDS = 0.05;

export type CapScrollTopByProgressRateInput = {
    previousTop: number;
    currentTop: number;
    deltaSeconds: number;
    maxScrollablePx: number;
    maxProgressPerSecond: number;
};

export function clampFrameDeltaSeconds(deltaSeconds: number): number {
    return Math.min(
        MAX_FRAME_DELTA_SECONDS,
        Math.max(MIN_FRAME_DELTA_SECONDS, deltaSeconds)
    );
}

export function capScrollTopByProgressRate({
    previousTop,
    currentTop,
    deltaSeconds,
    maxScrollablePx,
    maxProgressPerSecond,
}: CapScrollTopByProgressRateInput): number {
    if (maxScrollablePx <= 1 || maxProgressPerSecond <= 0) {
        return currentTop;
    }

    const frameDt = clampFrameDeltaSeconds(deltaSeconds);
    const maxProgressStep = maxProgressPerSecond * frameDt;
    const maxPixelStep = maxProgressStep * maxScrollablePx;
    const deltaTop = currentTop - previousTop;

    if (Math.abs(deltaTop) <= maxPixelStep) {
        return currentTop;
    }

    return previousTop + Math.sign(deltaTop) * maxPixelStep;
}

