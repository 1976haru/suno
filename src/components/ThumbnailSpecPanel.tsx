import { useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { copyText } from '../utils/exporters';
import type { ThumbnailSpec } from '../core/thumbnailSpec';

interface ThumbnailSpecPanelProps {
  spec: ThumbnailSpec;
  onRegenerateHeadline: () => void;
}

export default function ThumbnailSpecPanel({ spec, onRegenerateHeadline }: ThumbnailSpecPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const headlineLines = spec.headline.split('\n');

  async function handleCopy(field: string, text: string) {
    await copyText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(prev => (prev === field ? null : prev)), 1500);
  }

  const fullSpecText = [
    `Headline: ${spec.headline.replace('\n', ' / ')}`,
    `Subline: ${spec.subline}`,
    `Colors: background ${spec.colorScheme.background}, accent ${spec.colorScheme.accent}, text ${spec.colorScheme.text}`,
    `Objects: ${spec.objects.join(', ')}`,
    `Composition: ${spec.composition}`,
    `Forbidden: ${spec.forbidden.join(' / ')}`,
    `Image prompt: ${spec.imagePrompt}`
  ].join('\n');

  return (
    <section className="thumbnail-spec">
      <p className="step-hint">
        이 앱은 이미지를 직접 만들지 않습니다. 대신 Canva 등에서 바로 쓸 수 있는 썸네일 사양(문구·색상·오브제·이미지 프롬프트)을 만들어 드려요.
      </p>

      <div
        className="thumbnail-preview"
        style={{ background: spec.colorScheme.background, color: spec.colorScheme.text }}
      >
        <div className="thumbnail-preview-text">
          {headlineLines.map((line, i) => (
            <div key={i} className="thumbnail-preview-headline">{line}</div>
          ))}
          <div className="thumbnail-preview-subline" style={{ color: spec.colorScheme.accent }}>{spec.subline}</div>
        </div>
      </div>

      <div className="signature-grid">
        <div>
          <b>컬러</b>
          <span className="thumbnail-swatches">
            <span className="thumbnail-swatch" style={{ background: spec.colorScheme.background }} title={spec.colorScheme.background} />
            <span className="thumbnail-swatch" style={{ background: spec.colorScheme.accent }} title={spec.colorScheme.accent} />
            <span className="thumbnail-swatch" style={{ background: spec.colorScheme.text }} title={spec.colorScheme.text} />
            {spec.colorScheme.background} · {spec.colorScheme.accent} · {spec.colorScheme.text}
          </span>
        </div>
        <div><b>오브제</b><span>{spec.objects.join(' · ')}</span></div>
        <div style={{ gridColumn: '1 / -1' }}><b>구도</b><span>{spec.composition}</span></div>
        <div style={{ gridColumn: '1 / -1' }}><b>⛔ 금지 요소</b><span>{spec.forbidden.join(' · ')}</span></div>
      </div>

      <div className="copy-block">
        <div className="copy-head">
          <h4>이미지 생성 프롬프트 (영어)</h4>
          <button type="button" onClick={() => void handleCopy('imagePrompt', spec.imagePrompt)}>
            <Copy size={15} />
            {copiedField === 'imagePrompt' ? '복사됨' : '복사'}
          </button>
        </div>
        <pre>{spec.imagePrompt}</pre>
      </div>

      <div className="button-row">
        <button type="button" onClick={() => void handleCopy('headline', `${spec.headline.replace('\n', ' ')} / ${spec.subline}`)}>
          <Copy size={16} />
          {copiedField === 'headline' ? '복사됨' : '📋 문구 복사'}
        </button>
        <button type="button" onClick={() => void handleCopy('full', fullSpecText)}>
          <Copy size={16} />
          {copiedField === 'full' ? '복사됨' : '전체 사양 복사'}
        </button>
        <button type="button" onClick={onRegenerateHeadline}>
          <RefreshCw size={16} />
          🔄 다른 문구 제안
        </button>
      </div>
    </section>
  );
}
