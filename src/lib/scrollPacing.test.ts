import test from "node:test";
import assert from "node:assert/strict";

import {
    capScrollTopByProgressRate,
    clampFrameDeltaSeconds,
} from "./scrollPacing.ts";

const EPSILON = 1e-9;

test("capScrollTopByProgressRate keeps normalized progress step viewport-invariant", () => {
    const dt = clampFrameDeltaSeconds(1 / 60);
    const maxProgressPerSecond = 0.08;

    const phoneScrollablePx = 19200;
    const ipadScrollablePx = 28320;

    const phoneTop = capScrollTopByProgressRate({
        previousTop: 0,
        currentTop: 10000,
        deltaSeconds: dt,
        maxScrollablePx: phoneScrollablePx,
        maxProgressPerSecond,
    });

    const ipadTop = capScrollTopByProgressRate({
        previousTop: 0,
        currentTop: 10000,
        deltaSeconds: dt,
        maxScrollablePx: ipadScrollablePx,
        maxProgressPerSecond,
    });

    const phoneProgressStep = phoneTop / phoneScrollablePx;
    const ipadProgressStep = ipadTop / ipadScrollablePx;

    assert.ok(Math.abs(phoneProgressStep - ipadProgressStep) < EPSILON);
});

test("capScrollTopByProgressRate does not clamp when below threshold", () => {
    const result = capScrollTopByProgressRate({
        previousTop: 120,
        currentTop: 130,
        deltaSeconds: 1 / 60,
        maxScrollablePx: 20000,
        maxProgressPerSecond: 0.1,
    });

    assert.equal(result, 130);
});

test("capScrollTopByProgressRate returns currentTop when no scrollable range exists", () => {
    const result = capScrollTopByProgressRate({
        previousTop: 20,
        currentTop: 500,
        deltaSeconds: 1 / 60,
        maxScrollablePx: 0,
        maxProgressPerSecond: 0.1,
    });

    assert.equal(result, 500);
});

