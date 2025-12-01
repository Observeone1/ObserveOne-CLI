/**
 * Service tokens (symbols) for dependency injection
 * Each service is identified by a unique symbol
 */

// Core services
export const CONFIG_SERVICE = Symbol("CONFIG_SERVICE");
export const OUTPUT_SERVICE = Symbol("OUTPUT_SERVICE");
export const API_CLIENT = Symbol("API_CLIENT");
export const SSE_CLIENT = Symbol("SSE_CLIENT");

// Infrastructure services
export const FILE_SYSTEM = Symbol("FILE_SYSTEM");
export const PROCESS = Symbol("PROCESS");
