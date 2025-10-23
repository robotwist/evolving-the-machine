// Asset preloading and lazy loading system
export interface AssetManifest {
  textures: Record<string, string>;
  sounds: Record<string, string>;
  geometries: Record<string, string>;
  fonts: Record<string, string>;
}

type AssetType = HTMLImageElement | HTMLAudioElement | object;

export class AssetLoader {
  private loadedAssets: Map<string, AssetType> = new Map();
  private loadingPromises: Map<string, Promise<AssetType>> = new Map();

  // Asset manifest for all game assets
  private manifest: AssetManifest = {
    textures: {
      asphalt: '/textures/asphalt.png',
      grass: '/textures/grass.png',
      sand: '/textures/sand.jpg',
      sky: '/textures/sky.png',
      wood: '/textures/wood.jpg',
    },
    sounds: {
      background: '/sounds/background.mp3',
      hit: '/sounds/hit.mp3',
      success: '/sounds/success.mp3',
      uiClick: '/sounds/ui-click.mp3',
    },
    geometries: {
      heart: '/geometries/heart.gltf',
    },
    fonts: {
      inter: '/fonts/inter.json',
    }
  };

  // Preload critical assets on app start
  async preloadCriticalAssets(): Promise<void> {
    const criticalAssets = [
      this.manifest.textures.asphalt,
      this.manifest.textures.grass,
      this.manifest.sounds.background,
      this.manifest.fonts.inter,
    ];

    // Use Promise.allSettled to handle individual failures gracefully
    const results = await Promise.allSettled(criticalAssets.map(asset => this.loadAsset(asset)));

    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;

    console.log(`✅ Critical assets preloaded: ${successful} successful, ${failed} failed`);

    // Don't throw error if some assets fail - let the app continue
    if (failed > 0) {
      console.warn(`⚠️ ${failed} critical assets failed to load`);
    }
  }

  // Lazy load assets when needed
  async loadAsset(url: string): Promise<AssetType> {
    // Return cached asset if already loaded
    if (this.loadedAssets.has(url)) {
      return this.loadedAssets.get(url)!;
    }

    // Return existing loading promise if asset is currently loading
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    // Start loading the asset
    const loadPromise = this.loadAssetInternal(url);
    this.loadingPromises.set(url, loadPromise);

    try {
      const asset = await loadPromise;
      this.loadedAssets.set(url, asset);
      this.loadingPromises.delete(url);
      return asset;
    } catch (error) {
      this.loadingPromises.delete(url);
      throw error;
    }
  }

  private async loadAssetInternal(url: string): Promise<AssetType> {
    const extension = url.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'png':
      case 'jpg':
      case 'jpeg':
        return this.loadImage(url);
      case 'mp3':
      case 'ogg':
      case 'wav':
        return this.loadAudio(url);
      case 'gltf':
      case 'glb':
        return this.loadGeometry(url);
      case 'json':
        return this.loadJSON(url);
      default:
        throw new Error(`Unsupported asset type: ${extension}`);
    }
  }

  private async loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  private async loadAudio(url: string): Promise<HTMLAudioElement> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.preload = 'auto';

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Failed to load audio: ${url} (timeout)`));
      }, 5000); // 5 second timeout

      const cleanup = () => {
        clearTimeout(timeout);
        audio.oncanplay = null;
        audio.oncanplaythrough = null;
        audio.onload = null;
        audio.onerror = null;
      };

      const onSuccess = () => {
        cleanup();
        resolve(audio);
      };

      const onError = () => {
        cleanup();
        reject(new Error(`Failed to load audio: ${url}`));
      };

      // Use multiple events for better compatibility
      audio.oncanplay = onSuccess;
      audio.oncanplaythrough = onSuccess;
      audio.onload = onSuccess;
      audio.onerror = onError;

      audio.src = url;
    });
  }

  private async loadGeometry(url: string): Promise<object> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load geometry: ${url}`);
    }
    return response.json();
  }

  private async loadJSON(url: string): Promise<object> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load JSON: ${url}`);
    }
    return response.json();
  }

  // Get asset by key from manifest
  async getAsset(key: string, category: keyof AssetManifest): Promise<AssetType> {
    const url = this.manifest[category][key];
    if (!url) {
      throw new Error(`Asset not found: ${key} in category ${category}`);
    }
    return this.loadAsset(url);
  }

  // Preload assets for a specific game stage
  async preloadStageAssets(stage: number): Promise<void> {
    const stageAssets = this.getStageAssets(stage);
    await Promise.all(stageAssets.map(asset => this.loadAsset(asset)));
    console.log(`✅ Stage ${stage} assets preloaded`);
  }

  private getStageAssets(stage: number): string[] {
    // Define which assets are needed for each stage
    const stageAssetMap: Record<number, string[]> = {
      1: [this.manifest.textures.asphalt, this.manifest.sounds.hit], // Pong
      2: [this.manifest.textures.wood, this.manifest.sounds.hit, this.manifest.sounds.success], // Breakout
      3: [this.manifest.textures.sky, this.manifest.sounds.hit], // Asteroids
      4: [this.manifest.textures.grass, this.manifest.sounds.hit], // Defender
      5: [this.manifest.textures.sand, this.manifest.sounds.hit], // Lasat
      6: [this.manifest.textures.grass, this.manifest.sounds.background], // Dance Interlude
      7: [this.manifest.textures.sky, this.manifest.sounds.hit], // Star Wars
      8: [this.manifest.textures.asphalt, this.manifest.sounds.hit], // Betrayal
    };

    return stageAssetMap[stage] || [];
  }

  // Get loading progress for a set of assets
  getLoadingProgress(urls: string[]): number {
    const total = urls.length;
    const loaded = urls.filter(url => this.loadedAssets.has(url)).length;
    return total > 0 ? loaded / total : 1;
  }
}

// Global asset loader instance
export const assetLoader = new AssetLoader();
