import { create } from 'zustand'

const TOKEN_KEY = 'providai_token'

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY) || null,
  loading: false,
  initialized: false,

  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token)
    set({ token, user, initialized: true })
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ token: null, user: null, initialized: true })
  },

  setLoading: (loading) => set({ loading }),
  setInitialized: () => set({ initialized: true }),

  isLoggedIn: () => !!(get().token && get().user),
  getToken: () => get().token
}))
