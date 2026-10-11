import { describe, expect, it } from 'vitest';
import { shortcutAction, type KeyStroke } from './shortcuts';

const stroke = (key: string, modifiers: Partial<KeyStroke> = {}): KeyStroke => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...modifiers,
});

describe('shortcutAction', () => {
  it('Ctrl+Z urung, Ctrl+Y dan Ctrl+Shift+Z ulang', () => {
    expect(shortcutAction(stroke('z', { ctrlKey: true }))).toBe('undo');
    expect(shortcutAction(stroke('y', { ctrlKey: true }))).toBe('redo');
    expect(shortcutAction(stroke('Z', { ctrlKey: true, shiftKey: true }))).toBe('redo');
  });

  it('⌘ setara dengan Ctrl', () => {
    expect(shortcutAction(stroke('z', { metaKey: true }))).toBe('undo');
    expect(shortcutAction(stroke('z', { metaKey: true, shiftKey: true }))).toBe('redo');
  });

  it('Delete dan Backspace menghapus, R memutar, Esc melepas pilihan', () => {
    expect(shortcutAction(stroke('Delete'))).toBe('remove');
    expect(shortcutAction(stroke('Backspace'))).toBe('remove');
    expect(shortcutAction(stroke('r'))).toBe('rotate');
    expect(shortcutAction(stroke('R'))).toBe('rotate');
    expect(shortcutAction(stroke('Escape'))).toBe('clear-selection');
  });

  it('Ctrl+A memilih semua', () => {
    expect(shortcutAction(stroke('a', { ctrlKey: true }))).toBe('select-all');
  });

  it('tombol lain dan kombinasi dengan Alt bukan pintasan', () => {
    expect(shortcutAction(stroke('z'))).toBeUndefined();
    expect(shortcutAction(stroke('y'))).toBeUndefined();
    expect(shortcutAction(stroke('r', { ctrlKey: true }))).toBeUndefined();
    expect(shortcutAction(stroke('z', { ctrlKey: true, altKey: true }))).toBeUndefined();
    expect(shortcutAction(stroke('Delete', { altKey: true }))).toBeUndefined();
    expect(shortcutAction(stroke('Enter'))).toBeUndefined();
  });
});
