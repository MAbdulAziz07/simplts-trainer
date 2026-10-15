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

  it('mode tunjuk penyebab awalnya mati dan diatur lewat setPointingCause', () => {
    expect(useUiStore.getState().pointingCause).toBe(false);
    useUiStore.getState().setPointingCause(true);
    expect(useUiStore.getState().pointingCause).toBe(true);
    useUiStore.getState().setPointingCause(false);
    expect(useUiStore.getState().pointingCause).toBe(false);
  });
});
