import type { DungeonDefinition } from "../game/campaign";
import type { GameSoundId } from "../game/types";

export const GAME_SOUND_PATHS: Readonly<Record<GameSoundId, string>> = {
  step: "/assets/sounds/step.mp3",
  water: "/assets/sounds/water.mp3",
  hit: "/assets/sounds/hit.mp3",
  hitSlash: "/assets/sounds/hit_slash.mp3",
  death: "/assets/sounds/death.mp3",
  levelUp: "/assets/sounds/levelup.mp3",
  item: "/assets/sounds/item.mp3",
  drink: "/assets/sounds/drink.mp3",
  read: "/assets/sounds/read.mp3",
  eat: "/assets/sounds/eat.mp3",
  doorOpen: "/assets/sounds/door_open.mp3",
  unlock: "/assets/sounds/unlock.mp3",
  trample: "/assets/sounds/trample.mp3",
  teleport: "/assets/sounds/teleport.mp3",
  shatter: "/assets/sounds/shatter.mp3",
  descend: "/assets/sounds/descend.mp3",
  healthWarn: "/assets/sounds/health_warn.mp3",
  equip: "/assets/sounds/equip.mp3",
  uiClick: "/assets/sounds/click.mp3",
  skillArrow: "/assets/sounds/hit_arrow.mp3",
  skillBlast: "/assets/sounds/blast.mp3",
  skillGas: "/assets/sounds/gas.mp3",
  skillHeal: "/assets/sounds/dewdrop.mp3",
  skillImpact: "/assets/sounds/hit_strong.mp3",
  skillLightning: "/assets/sounds/lightning.mp3",
  skillMagic: "/assets/sounds/zap.mp3",
  skillNature: "/assets/sounds/plant.mp3",
  skillShadow: "/assets/sounds/cursed.mp3",
};

type OriginalMusicRegion = "sewers" | "prison" | "caves" | "city" | "halls";
const DUNGEON_MUSIC_VOLUME = 0.36;

const MUSIC_REGION_BY_THEME: Readonly<Record<string, OriginalMusicRegion>> = {
  flooded_sewers: "sewers",
  sunken_archive: "sewers",
  frozen_aqueduct: "sewers",
  drowned_temple: "sewers",
  prison_ruins: "prison",
  brigand_vault: "prison",
  shattered_watchtower: "prison",
  forgotten_catacombs: "caves",
  ember_mine: "caves",
  crystal_cavern: "caves",
  plague_laboratory: "city",
  overgrown_shrine: "halls",
};

const MUSIC_REGIONS: readonly OriginalMusicRegion[] = [
  "sewers",
  "prison",
  "caves",
  "city",
  "halls",
];

export const ORIGINAL_DUNGEON_MUSIC_PATHS = Object.freeze(
  MUSIC_REGIONS.flatMap((region) =>
    [1, 2, 3].map((track) => `/assets/music/${region}_${track}.ogg`),
  ),
);

export const dungeonMusicPath = (
  dungeon: Pick<DungeonDefinition, "themeId">,
  floor: number,
) => {
  const region = MUSIC_REGION_BY_THEME[dungeon.themeId] ?? "sewers";
  const track = ((Math.max(1, Math.floor(floor)) - 1) % 3) + 1;
  return `/assets/music/${region}_${track}.ogg`;
};

/**
 * Owns browser media elements for one dungeon run. Playback is explicitly
 * unlocked from a pointer/key gesture so delayed turn-resolution sounds do
 * not disappear behind the browser's autoplay policy.
 */
export class GameAudioRuntime {
  private fallbackSources: Partial<Record<GameSoundId, HTMLAudioElement>> = {};
  private fallbackEffects = new Set<HTMLAudioElement>();
  private fallbackMusic: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private bufferLoads = new Map<string, Promise<AudioBuffer>>();
  private activeEffects = new Set<AudioBufferSourceNode>();
  private musicSource: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private musicLoad: { path: string; request: number; promise: Promise<void> } | null = null;
  private currentMusicPath: string | null = null;
  private musicRequest = 0;
  private enabled = true;
  private primed = false;
  private destroyed = false;

  preload() {
    if (this.destroyed || typeof Audio === "undefined") return;
    for (const [name, path] of Object.entries(GAME_SOUND_PATHS) as Array<
      [GameSoundId, string]
    >) {
      if (this.fallbackSources[name]) continue;
      const audio = new Audio(path);
      audio.preload = "auto";
      audio.load();
      this.fallbackSources[name] = audio;
    }
  }

  setMusic(path: string | null) {
    if (this.destroyed || this.currentMusicPath === path) return;
    this.musicRequest += 1;
    this.stopMusicPlayback();
    this.currentMusicPath = path;
    if (path && this.enabled && this.primed) void this.ensureMusicPlaying();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) return;
    this.stopMusicPlayback();
    for (const source of this.activeEffects) {
      try {
        source.stop();
      } catch {
        // A source that already ended is safe to discard.
      }
    }
    this.activeEffects.clear();
    for (const audio of this.fallbackEffects) {
      audio.pause();
      audio.currentTime = 0;
    }
    this.fallbackEffects.clear();
  }

  async unlock() {
    if (this.destroyed || !this.enabled) return;
    this.preload();
    // Start every browser-gated operation before the first await. Some
    // browsers discard transient user activation as soon as an async boundary
    // is crossed, even when this method began in a pointer/key handler.
    const contextAttempt = this.resumeContext();
    const music = this.ensureFallbackMusic();
    const musicAttempt = music?.paused
      ? this.playMediaElement(music, true)
      : Promise.resolve(Boolean(music && !music.paused));
    const [contextRunning, musicPlaying] = await Promise.all([
      contextAttempt,
      musicAttempt,
    ]);
    // A muted/zero-volume primer must never count as an audible unlock. Chrome
    // and Edge may allow muted autoplay while continuing to reject every real
    // sound, which was the source of the all-silent regression.
    if (contextRunning || musicPlaying) {
      this.primed = true;
      void this.loadBuffer(GAME_SOUND_PATHS.uiClick).catch(() => undefined);
      void this.ensureMusicPlaying();
    }
  }

  async unlockAndPlay(
    name: GameSoundId,
    volume = 0.62,
    playbackRate = 1,
  ) {
    if (this.destroyed || !this.enabled) return;
    this.preload();
    // HTML media playback is deliberately invoked synchronously in the input
    // handler. Awaiting unlock() first loses the gesture on stricter browsers.
    const directPlayback = this.playFallback(name, volume, playbackRate);
    const unlockAttempt = this.unlock();
    const playedDirectly = await directPlayback;
    await unlockAttempt;
    if (
      !playedDirectly &&
      this.context?.state === "running" &&
      this.primed
    ) {
      await this.playDecoded(name, volume, playbackRate);
    }
  }

  play(
    name: GameSoundId,
    volume = 0.62,
    playbackRate = 1,
  ) {
    if (this.destroyed || !this.enabled) return;
    this.preload();
    if (this.context?.state === "running" && this.primed) {
      void this.playDecoded(name, volume, playbackRate);
      return;
    }
    // Preserve the pre-modularization behavior as the reliable fallback:
    // always attempt an audible HTMLAudioElement directly. Never suppress an
    // attempt merely because an earlier muted primer claimed to be unlocked.
    const fallbackPlayback = this.playFallback(name, volume, playbackRate);
    const contextAttempt = this.resumeContext();
    void Promise.all([fallbackPlayback, contextAttempt]).then(
      ([playedDirectly, contextRunning]) => {
        if (
          !playedDirectly &&
          contextRunning &&
          !this.destroyed &&
          this.enabled
        ) {
          void this.playDecoded(name, volume, playbackRate);
        }
      },
    );
  }

  private ensureContext() {
    if (this.context && this.context.state !== "closed") return this.context;
    const audioGlobal = globalThis as typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextConstructor =
      typeof audioGlobal.AudioContext === "function"
        ? audioGlobal.AudioContext
        : audioGlobal.webkitAudioContext;
    if (!AudioContextConstructor) return null;
    try {
      this.context = new AudioContextConstructor();
      return this.context;
    } catch {
      return null;
    }
  }

  private async resumeContext() {
    const context = this.ensureContext();
    if (!context) return false;
    try {
      const state = context.state as AudioContextState | "interrupted";
      if (state === "suspended" || state === "interrupted") {
        await context.resume();
      }
      if (context.state !== "running") return false;
      this.primed = true;
      return true;
    } catch {
      return false;
    }
  }

  private async loadBuffer(path: string) {
    const cached = this.buffers.get(path);
    if (cached) return cached;
    const existing = this.bufferLoads.get(path);
    if (existing) return existing;
    const context = this.context;
    if (!context) throw new Error("Audio context is unavailable.");
    const pending = fetch(path, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`Audio request failed: ${path}`);
        return response.arrayBuffer();
      })
      .then((bytes) => context.decodeAudioData(bytes.slice(0)))
      .then((buffer) => {
        this.buffers.set(path, buffer);
        this.bufferLoads.delete(path);
        return buffer;
      })
      .catch((error) => {
        this.bufferLoads.delete(path);
        throw error;
      });
    this.bufferLoads.set(path, pending);
    return pending;
  }

  private async playDecoded(
    name: GameSoundId,
    volume: number,
    playbackRate: number,
  ) {
    const context = this.context;
    if (!context) return this.playFallback(name, volume, playbackRate);
    try {
      const buffer = await this.loadBuffer(GAME_SOUND_PATHS[name]);
      if (
        this.destroyed ||
        !this.enabled ||
        context.state !== "running"
      ) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = Math.max(0.25, Math.min(4, playbackRate));
      gain.gain.value = Math.max(0, Math.min(1, volume));
      source.connect(gain);
      gain.connect(context.destination);
      const release = () => {
        this.activeEffects.delete(source);
        source.disconnect();
        gain.disconnect();
      };
      source.addEventListener("ended", release, { once: true });
      this.activeEffects.add(source);
      source.start();
    } catch {
      this.playFallback(name, volume, playbackRate);
    }
  }

  private playFallback(
    name: GameSoundId,
    volume: number,
    playbackRate: number,
  ) {
    if (this.destroyed || !this.enabled) return Promise.resolve(false);
    const source = this.fallbackSources[name];
    if (!source) return Promise.resolve(false);
    const audio = source.cloneNode(true) as HTMLAudioElement;
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.playbackRate = Math.max(0.25, Math.min(4, playbackRate));
    const release = () => this.fallbackEffects.delete(audio);
    audio.addEventListener("ended", release, { once: true });
    audio.addEventListener("error", release, { once: true });
    this.fallbackEffects.add(audio);
    const playback = this.playMediaElement(audio, true);
    void playback.then((started) => {
      if (!started) release();
    });
    return playback;
  }

  private async playMediaElement(
    audio: HTMLAudioElement,
    markAudibleUnlock: boolean,
  ) {
    try {
      // Calling play() must remain in the current stack when this method is
      // entered from a trusted pointer/key event.
      await audio.play();
      if (markAudibleUnlock && !audio.muted && audio.volume > 0) {
        this.primed = true;
      }
      return true;
    } catch {
      return false;
    }
  }

  private ensureFallbackMusic() {
    const path = this.currentMusicPath;
    if (!path || typeof Audio === "undefined") return null;
    if (this.fallbackMusic?.src.endsWith(path)) return this.fallbackMusic;
    this.fallbackMusic?.pause();
    const music = new Audio(path);
    music.preload = "auto";
    music.loop = true;
    music.volume = DUNGEON_MUSIC_VOLUME;
    music.load();
    this.fallbackMusic = music;
    return music;
  }

  private async ensureMusicPlaying() {
    const path = this.currentMusicPath;
    if (
      !path ||
      this.destroyed ||
      !this.enabled ||
      !this.primed ||
      this.musicSource ||
      (this.fallbackMusic && !this.fallbackMusic.paused)
    ) return;
    const request = this.musicRequest;
    if (this.musicLoad?.path === path && this.musicLoad.request === request) {
      return this.musicLoad.promise;
    }
    const promise = this.startMusic(path, request).finally(() => {
      if (
        this.musicLoad?.path === path &&
        this.musicLoad.request === request
      ) this.musicLoad = null;
    });
    this.musicLoad = { path, request, promise };
    return promise;
  }

  private async startMusic(path: string, request: number) {
    const context = this.context;
    if (context?.state === "running") {
      try {
        const buffer = await this.loadBuffer(path);
        if (
          this.destroyed ||
          !this.enabled ||
          request !== this.musicRequest ||
          path !== this.currentMusicPath ||
          context.state !== "running"
        ) return;
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        source.loop = true;
        gain.gain.value = DUNGEON_MUSIC_VOLUME;
        source.connect(gain);
        gain.connect(context.destination);
        source.start();
        this.musicSource = source;
        this.musicGain = gain;
        return;
      } catch {
        // Decode support differs by browser; HTML media is the final fallback.
      }
    }
    if (this.destroyed || !this.enabled) return;
    const music = this.ensureFallbackMusic();
    if (
      !music ||
      request !== this.musicRequest ||
      path !== this.currentMusicPath
    ) return;
    await this.playMediaElement(music, true);
  }

  private stopMusicPlayback() {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch {
        // A source that already ended is safe to discard.
      }
      this.musicSource.disconnect();
      this.musicSource = null;
    }
    this.musicGain?.disconnect();
    this.musicGain = null;
    this.fallbackMusic?.pause();
    if (this.fallbackMusic) this.fallbackMusic.currentTime = 0;
    this.fallbackMusic = null;
  }

  destroy() {
    this.destroyed = true;
    this.musicRequest += 1;
    this.stopMusicPlayback();
    for (const source of this.activeEffects) {
      try {
        source.stop();
      } catch {
        // A source that already ended is safe to discard.
      }
    }
    this.activeEffects.clear();
    for (const audio of this.fallbackEffects) audio.pause();
    this.fallbackEffects.clear();
    for (const source of Object.values(this.fallbackSources)) source?.pause();
    this.fallbackSources = {};
    this.buffers.clear();
    this.bufferLoads.clear();
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }
}
