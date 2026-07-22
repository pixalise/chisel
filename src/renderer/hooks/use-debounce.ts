import { DebouncedFunc, debounce } from "lodash";
import { useCallback, useEffect, useRef } from "react";

export interface UseDebounceResult {
  cancel: () => void;
  debounce: (cb: () => Promise<void> | void) => void;
}

export const useDebounce = (timeout: number): UseDebounceResult => {
  const debounceRef = useRef<DebouncedFunc<() => Promise<void>> | null>(null);

  const onDebounce = useCallback(
    async (cb: () => Promise<void> | void) => {
      debounceRef.current?.cancel();
      debounceRef.current = debounce(cb, timeout);
      debounceRef.current();
    },
    [timeout]
  );

  useEffect(() => {
    return () => {
      debounceRef.current?.cancel();
    };
  }, []);

  return {
    debounce: onDebounce,
    cancel: () => debounceRef.current?.cancel()
  };
};
