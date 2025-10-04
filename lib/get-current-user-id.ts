import { TEST_USER_ID } from "./constants"

/**
 * Get the current user ID for API calls
 * In dev/preview: returns TEST_USER_ID
 * In production: returns user_${auth_id} format
 */
export function getCurrentUserId(authUserId?: string): string {
  if (isAuthBypassed()) {
    return TEST_USER_ID
  }

  if (!authUserId) {
    return TEST_USER_ID // Fallback
  }

  return `user_${authUserId}`
}

/**
 * Check if we're in bypass mode (dev/preview)
 */
export function isAuthBypassed(): boolean {
  const isDev = process.env.NODE_ENV === "development"
  const isPreview = process.env.VERCEL_ENV === "preview"
  const isPublicVercelEnvDev = process.env.NEXT_PUBLIC_VERCEL_ENV === "development"

  return isDev || isPreview || isPublicVercelEnvDev
}
