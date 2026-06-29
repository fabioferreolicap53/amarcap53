import { useState, useEffect } from 'react';

/**
 * Debounce um valor. Retorna o valor atualizado apenas após `delay` ms sem mudanças.
 * Ex: useDebounce(searchTerm, 400) → só atualiza 400ms após usuário parar de digitar.
 */
export function useDebounce<T>(value: T, delay: number = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
