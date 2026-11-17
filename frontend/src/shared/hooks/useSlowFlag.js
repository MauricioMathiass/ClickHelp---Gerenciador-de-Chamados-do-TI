import { useEffect, useState } from "react";

/** Depois disso, uma espera vira "o servidor está acordando". */
export const SLOW_WAIT_MS = 6000;

/**
 * Fica `true` quando `isActive` passa de alguns segundos. Serve para avisar da
 * partida a frio do servidor (o plano gratuito dorme sem uso e leva até ~1 min).
 */
export const useSlowFlag = (isActive, delay = SLOW_WAIT_MS) => {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const id = window.setTimeout(() => setIsSlow(true), delay);
    return () => {
      window.clearTimeout(id);
      setIsSlow(false);
    };
  }, [isActive, delay]);

  return isSlow;
};

/** Texto único para a partida a frio, usado no login e nas telas que carregam dados. */
export const COLD_START_MESSAGE =
  "O servidor está acordando depois de um tempo parado. Isso pode levar até 1 minuto. Não precisa tentar de novo.";
