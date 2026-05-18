import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface AppState {
  activeBoardId: string | null;
  sidebarCollapsed: boolean;
  setActiveBoardId: (id: string | null) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      activeBoardId: null,
      sidebarCollapsed: false,
      setActiveBoardId: (id) => set({ activeBoardId: id }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { enabled: import.meta.env.DEV, name: 'BanyanBoard-AppStore' },
  ),
);
