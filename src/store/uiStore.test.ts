import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => useUiStore.setState({ inspectorOpen: false }));

  it('panel parameter awalnya tertutup dan dibuka-tutup lewat toggleInspector', () => {
    expect(useUiStore.getState().inspectorOpen).toBe(false);
    useUiStore.getState().toggleInspector();
    expect(useUiStore.getState().inspectorOpen).toBe(true);
    useUiStore.getState().toggleInspector();
    expect(useUiStore.getState().inspectorOpen).toBe(false);
  });
});
