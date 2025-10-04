import { TEST_USER_ID } from "./constants"

/**
 * Get the current user ID for API calls
 * In preview: returns TEST_USER_ID
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
 * Check if we're in bypass mode (preview only)
 * NOTE: We only check VERCEL_ENV because NODE_ENV is "development" even in v0 production
 */
export function isAuthBypassed(): boolean {
  // NODE_ENV is unreliable in v0 (always "development")
  const isPreview = process.env.VERCEL_ENV === "preview"

  return isPreview
}
