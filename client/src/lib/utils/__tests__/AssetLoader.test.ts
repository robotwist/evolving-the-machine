import { AssetLoader } from '../AssetLoader';

describe('AssetLoader', () => {
  let assetLoader: AssetLoader;

  beforeEach(() => {
    assetLoader = new AssetLoader();
  });

  describe('getStageAssets', () => {
    it('should return correct assets for stage 1', () => {
      const assets = (assetLoader as any).getStageAssets(1);
      expect(assets).toEqual(['/textures/asphalt.png', '/sounds/hit.mp3']);
    });

    it('should return correct assets for stage 2', () => {
      const assets = (assetLoader as any).getStageAssets(2);
      expect(assets).toEqual(['/textures/wood.jpg', '/sounds/hit.mp3', '/sounds/success.mp3']);
    });

    it('should return empty array for invalid stage', () => {
      const assets = (assetLoader as any).getStageAssets(99);
      expect(assets).toEqual([]);
    });
  });

  describe('getLoadingProgress', () => {
    it('should calculate loading progress correctly', () => {
      const urls = ['/textures/test1.png', '/textures/test2.png', '/textures/test3.png'];

      // Initially no assets loaded
      expect(assetLoader.getLoadingProgress(urls)).toBe(0);

      // Simulate loading first asset
      (assetLoader as any).loadedAssets.set('/textures/test1.png', {});
      expect(assetLoader.getLoadingProgress(urls)).toBe(1/3);

      // Simulate loading second asset
      (assetLoader as any).loadedAssets.set('/textures/test2.png', {});
      expect(assetLoader.getLoadingProgress(urls)).toBe(2/3);

      // Simulate loading third asset
      (assetLoader as any).loadedAssets.set('/textures/test3.png', {});
      expect(assetLoader.getLoadingProgress(urls)).toBe(1);
    });

    it('should return 1 for empty array', () => {
      expect(assetLoader.getLoadingProgress([])).toBe(1);
    });
  });

  describe('manifest structure', () => {
    it('should have correct asset categories', () => {
      const manifest = (assetLoader as any).manifest;

      expect(manifest.textures).toBeDefined();
      expect(manifest.sounds).toBeDefined();
      expect(manifest.geometries).toBeDefined();
      expect(manifest.fonts).toBeDefined();
    });

    it('should have expected texture assets', () => {
      const textures = (assetLoader as any).manifest.textures;

      expect(textures.asphalt).toBe('/textures/asphalt.png');
      expect(textures.grass).toBe('/textures/grass.png');
      expect(textures.wood).toBe('/textures/wood.jpg');
    });

    it('should have expected sound assets', () => {
      const sounds = (assetLoader as any).manifest.sounds;

      expect(sounds.background).toBe('/sounds/background.mp3');
      expect(sounds.hit).toBe('/sounds/hit.mp3');
      expect(sounds.success).toBe('/sounds/success.mp3');
    });
  });
});
