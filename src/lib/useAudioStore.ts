"use client";

import { create } from 'zustand';
import { audioManager } from './audioManager';

interface AudioState {
  isMuted: boolean;
  isUnlocked: boolean;
  toggleMute: () => void;
  initialize: () => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  isMuted: true,
  isUnlocked: false,
  toggleMute: () => set((state) => {
    if (!state.isUnlocked) {
      audioManager.unlock();
      return { isMuted: false, isUnlocked: true };
    }
    const nextMuted = audioManager.toggleMute();
    return { isMuted: nextMuted };
  }),
  initialize: () => {
    if (typeof window === 'undefined') return;
    set({
      isMuted: audioManager.getMuted(),
      isUnlocked: audioManager.getUnlocked(),
    });
  },
}));
