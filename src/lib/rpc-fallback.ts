/**
 * Utilitários para lidar com fallback de RPCs de forma consistente
 */

import { safeNumber } from "./validation";
import { logger } from "./logger";

/**
 * Executa uma chamada RPC com fallback automático em caso de erro
 */
export async function withRpcFallback<T>(
  rpcCall: () => Promise<{ data: T | null; error: any }>,
  fallbackCall: () => Promise<T>,
  errorContext?: string
): Promise<T> {
  try {
    const { data, error } = await rpcCall();
    if (error) throw error;
    if (data === null || data === undefined) {
      throw new Error("RPC returned null/undefined");
    }
    return data;
  } catch (error) {
    if (errorContext) {
      logger.error(`Error in ${errorContext}:`, error);
    }
    try {
      return await fallbackCall();
    } catch (fallbackError) {
      logger.error(`Fallback failed for ${errorContext}:`, fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Processa resultado de RPC numérico com validação e fallback
 */
export async function processNumericRpc(
  rpcResult: { data: unknown; error: any } | null | undefined,
  fallbackCall: () => Promise<number>,
  errorContext?: string
): Promise<number> {
  if (rpcResult?.error) {
    if (errorContext) {
      logger.error(`Error fetching ${errorContext}:`, rpcResult.error);
    }
    try {
      return await fallbackCall();
    } catch (fallbackError) {
      if (errorContext) {
        logger.error(`Fallback ${errorContext} failed:`, fallbackError);
      }
      return 0;
    }
  }

  const rawValue = rpcResult?.data;
  const numValue = safeNumber(rawValue, 0);
  
  if (isNaN(numValue) || numValue < 0) {
    if (errorContext) {
      logger.error(`Invalid ${errorContext} value:`, rawValue);
    }
    try {
      return await fallbackCall();
    } catch (fallbackError) {
      if (errorContext) {
        logger.error(`Fallback ${errorContext} failed:`, fallbackError);
      }
      return 0;
    }
  }

  return numValue;
}
