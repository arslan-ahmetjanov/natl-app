import { useEffect } from 'react';

/**
 * Горячие клавиши экрана.
 *
 * Формат: 'mod+r', 'mod+shift+s', 'esc'. mod — Ctrl на Windows и Cmd на macOS.
 * Обработчики держим в объекте, чтобы не плодить подписки.
 */
export function useHotkeys(map, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const parts = [];
      if (mod) parts.push('mod');
      if (event.shiftKey) parts.push('shift');
      if (event.altKey) parts.push('alt');
      parts.push(key);

      const handler = map[parts.join('+')];
      if (handler) {
        event.preventDefault();
        handler(event);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [map, enabled]);
}
