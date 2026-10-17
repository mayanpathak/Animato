import { request } from './http'
import { envelope, userResponse } from './schemas'
import type * as z from 'zod/mini'

export interface User {
  email: string
  username: string
  isVerified: boolean
  createdAt?: string | null
  lastLogin?: string | null
}

function toUser(u: z.infer<typeof userResponse>['user']): User {
  return {
    email: u.email,
    username: u.username,
    isVerified: u.is_verified,
    createdAt: u.created_at,
    lastLogin: u.last_login,
  }
}

export const authApi = {
  checkAuth: async () => toUser((await request(userResponse, 'GET', '/auth/check-auth')).user),
  signup: async (username: string, email: string, password: string) =>
    toUser((await request(userResponse, 'POST', '/auth/signup', { username, email, password })).user),
  login: async (email: string, password: string) =>
    toUser((await request(userResponse, 'POST', '/auth/login', { email, password })).user),
  logout: () => request(envelope, 'POST', '/auth/logout'),
  verifyEmail: async (code: string) =>
    toUser((await request(userResponse, 'POST', '/auth/verify-email', { code })).user),
  resendVerification: () => request(envelope, 'POST', '/auth/resend-verification'),
  forgotPassword: (email: string) => request(envelope, 'POST', '/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    request(envelope, 'POST', `/auth/reset-password/${encodeURIComponent(token)}`, { password }),
}
