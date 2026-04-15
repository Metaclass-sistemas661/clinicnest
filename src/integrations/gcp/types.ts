/**
 * Database types — re-exports from original types file.
 * The Json type is framework-agnostic and can be kept as-is.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]
