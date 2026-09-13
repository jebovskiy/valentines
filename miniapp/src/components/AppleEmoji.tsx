import { useState } from 'react';

const EMOJI_CODEPOINTS: Record<string, string> = {
  '💌': '1f48c',
  '✨': '2728',
  '🌙': '1f319',
  '🔥': '1f525',
  '👤': '1f464',
  '📝': '1f4dd',
  '🎬': '1f3ac',
  '👥': '1f465',
  '📍': '1f4cd',
};

export function AppleEmoji({
  emoji,
  size = 24,
  style,
  className,
}: {
  emoji: string;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const codepoint = EMOJI_CODEPOINTS[emoji];
  const src = codepoint ? `https://cdn.jsdelivr.net/gh/iamcal/emoji-data@master/img-apple-160/${codepoint}.png` : null;

  if (!src || failed) {
    return (
      <span
        className={className}
        style={{ fontSize: size, lineHeight: 1, ...style }}
      >
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={emoji}
      loading="lazy"
      draggable={false}
      className={className}
      style={{ width: size, height: size, ...style }}
      onError={() => setFailed(true)}
    />
  );
}