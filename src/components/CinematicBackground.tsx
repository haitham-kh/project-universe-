"use client";

import React from "react";
import { GlbBackground } from "./GlbBackground";

export function CinematicBackground({ tier }: { tier: 0 | 1 | 2 | 3 }) {
    return (
        <group>
            {/* GLB-based Earth sphere background */}
            <GlbBackground tier={tier} />
        </group>
    );
}
