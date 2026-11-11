import { applyChanges, type CellChange } from '../sheet/ops';
import type { Sheet } from '../sheet/sheet';

/** 変わったマスの差分で持つ Undo/Redo。push には「適用済み」の差分を渡す。 */
export class History {
  private undoStack: (readonly CellChange[])[] = [];
  private redoStack: (readonly CellChange[])[] = [];

  constructor(private readonly limit = 200) {}

  push(changes: readonly CellChange[]): void {
    if (changes.length === 0) return;
    this.undoStack.push(changes);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(sheet: Sheet): boolean {
    const ch = this.undoStack.pop();
    if (!ch) return false;
    applyChanges(sheet, ch, 'backward');
    this.redoStack.push(ch);
    return true;
  }

  redo(sheet: Sheet): boolean {
    const ch = this.redoStack.pop();
    if (!ch) return false;
    applyChanges(sheet, ch, 'forward');
    this.undoStack.push(ch);
    return true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
