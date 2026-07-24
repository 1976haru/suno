import { describe, expect, it } from 'vitest';
import {
  estimateQwenImageCostCny,
  normalizeQwenImageSettings,
  qwenImageModelSupportsAsync,
  qwenResolutionAllowed,
  qwenResolutionFamily
} from '../src/core/qwenImageSettings';

describe('[v3.41] Qwen image settings', () => {
  it('normalizes unsafe persisted settings back to documented defaults', () => {
    const settings = normalizeQwenImageSettings({
      region: 'mars' as never,
      model: 'qwen-image-3.0' as never,
      resolution: '9999*9999' as never,
      sessionLimit: -10
    });

    expect(settings.region).toBe('singapore');
    expect(settings.model).toBe('qwen-image-2.0');
    expect(settings.resolution).toBe('2688*1536');
    expect(settings.sessionLimit).toBe(1);
  });

  it('keeps v2 and legacy resolution families separate', () => {
    expect(qwenResolutionFamily('qwen-image-3.0-pro')).toBe('v2');
    expect(qwenResolutionFamily('qwen-image-2.0-pro')).toBe('v2');
    expect(qwenResolutionFamily('qwen-image-plus')).toBe('legacy');
    expect(qwenResolutionAllowed('qwen-image-2.0', '2688*1536')).toBe(true);
    expect(qwenResolutionAllowed('qwen-image-2.0', '1664*928')).toBe(false);
    expect(qwenResolutionAllowed('qwen-image-plus', '1664*928')).toBe(true);
  });

  it('estimates image cost from the documented unit prices', () => {
    expect(estimateQwenImageCostCny('qwen-image-2.0', 10)).toBeCloseTo(2.56873, 6);
    expect(estimateQwenImageCostCny('qwen-image-2.0-pro', 2)).toBeCloseTo(1.100886, 6);
    expect(estimateQwenImageCostCny('qwen-image-3.0-pro', 5)).toBe(0);
  });

  it('marks only plus/image as async task models', () => {
    expect(qwenImageModelSupportsAsync('qwen-image-2.0')).toBe(false);
    expect(qwenImageModelSupportsAsync('qwen-image-plus')).toBe(true);
  });
});
