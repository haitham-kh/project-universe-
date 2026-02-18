'use client';

import { useEffect, useRef } from 'react';

export function BandwidthMonitor() {
    const totalBytesRef = useRef(0);
    const intervalsRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const logBandwidth = () => {
            if (typeof window === 'undefined') return;

            // Get all resource performance entries
            const resources = performance.getEntriesByType('resource');

            let total = 0;
            let glb = 0;
            let img = 0;
            let audio = 0;
            let script = 0;
            let other = 0;

            resources.forEach((entry: any) => {
                // Use transferSize (network) or encodedBodySize (if cache/cors hidden)
                // Note: transferSize is 0 for cached items usually, encodedBodySize gives size
                const size = entry.transferSize > 0 ? entry.transferSize : entry.encodedBodySize || 0;

                total += size;

                const name = entry.name.toLowerCase();
                if (name.includes('.glb') || name.includes('.gltf')) glb += size;
                else if (name.match(/\.(png|jpg|jpeg|webp|gif|svg)$/)) img += size;
                else if (name.match(/\.(mp3|wav|ogg)$/)) audio += size;
                else if (name.match(/\.(js|css)$/)) script += size;
                else other += size;
            });

            totalBytesRef.current = total;

            // Format bytes to MB
            const toMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

            console.groupCollapsed(`📊 Bandwidth Usage: ${toMB(total)} MB`);
            console.log(`MODELS (GLB):  ${toMB(glb)} MB`);
            console.log(`IMAGES:        ${toMB(img)} MB`);
            console.log(`AUDIO:         ${toMB(audio)} MB`);
            console.log(`SCRIPTS/CSS:   ${toMB(script)} MB`);
            console.log(`OTHER:         ${toMB(other)} MB`);
            console.log('--------------------------------');
            console.log('Note: Values might be 0 for cached assets or cross-origin requests without Timing-Allow-Origin header.');
            console.groupEnd();
        };

        // Log initially
        setTimeout(logBandwidth, 2000);

        // Log every 5 seconds
        intervalsRef.current = setInterval(logBandwidth, 5000);

        return () => {
            if (intervalsRef.current) clearInterval(intervalsRef.current);
        };
    }, []);

    return null; // Render nothing visible
}
