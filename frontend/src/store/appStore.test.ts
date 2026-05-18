import { useAppStore } from './appStore';

beforeEach(() => {
  useAppStore.setState({ activeBoardId: null, sidebarCollapsed: false });
});

describe('useAppStore', () => {
  it('initialises with correct default state', () => {
    const state = useAppStore.getState();
    expect(state.activeBoardId).toBeNull();
    expect(state.sidebarCollapsed).toBe(false);
  });

  it('setActiveBoardId updates activeBoardId', () => {
    useAppStore.getState().setActiveBoardId('board-1');
    expect(useAppStore.getState().activeBoardId).toBe('board-1');
  });

  it('toggleSidebar flips sidebarCollapsed', () => {
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(true);
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);
  });
});
