import { useRef, useCallback, type MouseEvent, type TouchEvent } from 'react';

/**
 * Detecta long press (segurar botão).
 * onLongPress dispara após 500ms de pressão sustentada.
 * onClick dispara em clique rápido (< 500ms).
 */
export function useLongPress(
  onLongPress: () => void,
  onClick: () => void,
  { delay = 500 } = {}
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const targetRef = useRef<EventTarget | null>(null);

  const start = useCallback((e: MouseEvent | TouchEvent) => {
    // Ignora botão do meio/direito
    if ('button' in e && e.button !== 0) return;
    isLongPress.current = false;
    targetRef.current = e.target;
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const stop = useCallback((e: MouseEvent | TouchEvent) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Se não foi long press e target é o mesmo (não arrastou fora), trata como click
    if (!isLongPress.current && targetRef.current === e.target) {
      onClick();
    }
  }, [onClick]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: stop,
    onTouchMove: cancel,
  };
}
