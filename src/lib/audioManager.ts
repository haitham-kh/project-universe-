"use client";

import { BASE_PATH } from "./basePath";

class AudioManager {
  private mainTheme: HTMLAudioElement | null = null;
  private sceneTransition: HTMLAudioElement | null = null;
  private loreOpen: HTMLAudioElement | null = null;
  private loreClose: HTMLAudioElement | null = null;
  private scrollPulse: HTMLAudioElement | null = null;
  private isMuted: boolean = true;
  private isUnlocked: boolean = false;
  private lastPulseTime: number = 0;

  constructor() {
    if (typeof window === 'undefined') return;

    try {
      this.mainTheme = new Audio(`${BASE_PATH}/sound-effects/main-theme.mp3`);
      this.mainTheme.loop = true;
      this.mainTheme.volume = 0; // Start at 0 for fade-in

      this.sceneTransition = new Audio(`${BASE_PATH}/sound-effects/scene-transition.mp3`);
      this.sceneTransition.volume = 0.55;

      this.loreOpen = new Audio(`${BASE_PATH}/sound-effects/lore-open.mp3`);
      this.loreOpen.volume = 0.45;

      this.loreClose = new Audio(`${BASE_PATH}/sound-effects/lore-close.mp3`);
      this.loreClose.volume = 0.4;

      this.scrollPulse = new Audio(`${BASE_PATH}/sound-effects/scroll-pulse.mp3`);
      this.scrollPulse.volume = 0.05;
    } catch (e) {
      console.warn('[AudioManager] Failed to initialize audio elements:', e);
    }
  }

  public unlock() {
    if (this.isUnlocked) return;
    this.isUnlocked = true;
    this.isMuted = false;

    if (this.mainTheme) {
      this.mainTheme.play()
        .then(() => {
          this.fadeVolume(this.mainTheme!, 0.4, 1500);
        })
        .catch(e => {
          console.warn('[AudioManager] Autoplay blocked, waiting for interaction:', e);
          this.isUnlocked = false;
          this.isMuted = true;
        });
    }
  }

  public toggleMute(): boolean {
    if (!this.isUnlocked) {
      this.unlock();
      return !this.isMuted;
    }

    const nextMuted = !this.isMuted;
    this.setMuted(nextMuted);
    return nextMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public getUnlocked(): boolean {
    return this.isUnlocked;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.mainTheme) {
      if (muted) {
        this.fadeVolume(this.mainTheme, 0, 400, () => {
          this.mainTheme?.pause();
        });
      } else {
        this.mainTheme.volume = 0;
        this.mainTheme.play()
          .then(() => {
            this.fadeVolume(this.mainTheme!, 0.4, 600);
          })
          .catch(() => {});
      }
    }
  }

  public playTransition() {
    if (this.isMuted || !this.isUnlocked || !this.sceneTransition) return;
    try {
      this.sceneTransition.currentTime = 0;
      this.sceneTransition.play().catch(() => {});
    } catch {}
  }

  public playLoreOpen() {
    if (this.isMuted || !this.isUnlocked || !this.loreOpen) return;
    try {
      this.loreOpen.currentTime = 0;
      this.loreOpen.play().catch(() => {});
    } catch {}
  }

  public playLoreClose() {
    if (this.isMuted || !this.isUnlocked || !this.loreClose) return;
    try {
      this.loreClose.currentTime = 0;
      this.loreClose.play().catch(() => {});
    } catch {}
  }

  public triggerScrollPulse() {
    if (this.isMuted || !this.isUnlocked || !this.scrollPulse) return;
    const now = Date.now();
    // Throttle scroll pulses so they don't overlap too much (max once every 400ms)
    if (now - this.lastPulseTime > 400) {
      try {
        this.scrollPulse.currentTime = 0;
        this.scrollPulse.play().catch(() => {});
        this.lastPulseTime = now;
      } catch {}
    }
  }

  private fadeVolume(audio: HTMLAudioElement, targetVolume: number, duration: number, onComplete?: () => void) {
    const startVolume = audio.volume;
    const startTime = performance.now();

    const update = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      audio.volume = startVolume + (targetVolume - startVolume) * progress;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        audio.volume = targetVolume;
        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(update);
  }
}

export const audioManager = typeof window !== 'undefined' ? new AudioManager() : {} as AudioManager;
