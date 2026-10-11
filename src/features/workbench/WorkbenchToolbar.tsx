import { Panel, useReactFlow } from '@xyflow/react';
import {
  Maximize,
  Redo2,
  RotateCw,
  SquareDashedMousePointer,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';
import { t } from '@/i18n';
import { useCircuitStore } from '@/store';
import { useFitWorkbench } from './useFitWorkbench';

interface ToolButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Untuk tombol yang menyala/padam (mode pilih banyak). */
  pressed?: boolean;
}

function ToolButton({ icon: Icon, label, onClick, disabled, pressed }: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-11 items-center justify-center rounded-lg disabled:opacity-30 ${
        pressed ? 'bg-brand text-white' : 'hover:bg-app'
      }`}
    >
      <Icon aria-hidden size={20} />
    </button>
  );
}

const Divider = () => <span aria-hidden className="bg-line mx-2 h-px" />;

interface WorkbenchToolbarProps {
  selectMode: boolean;
  onToggleSelectMode: () => void;
}

/** Bilah alat mengambang: tiap aksi keyboard juga punya tombol (docs/PRD.md US25). */
export function WorkbenchToolbar({ selectMode, onToggleSelectMode }: WorkbenchToolbarProps) {
  const { zoomIn, zoomOut } = useReactFlow();
  const fit = useFitWorkbench();
  const canUndo = useCircuitStore((state) => state.history.past.length > 0);
  const canRedo = useCircuitStore((state) => state.history.future.length > 0);
  const hasComponent = useCircuitStore((state) => state.selectedComponentIds.length > 0);
  const hasSelection = useCircuitStore(
    (state) => state.selectedComponentIds.length + state.selectedWireIds.length > 0,
  );
  const store = useCircuitStore.getState;

  return (
    <Panel position="top-left">
      <div
        role="toolbar"
        aria-label={t.actions.toolbar}
        aria-orientation="vertical"
        className="border-line bg-card flex flex-col rounded-xl border p-1 shadow-sm"
      >
        <ToolButton
          icon={Undo2}
          label={t.actions.undo}
          disabled={!canUndo}
          onClick={() => store().undo()}
        />
        <ToolButton
          icon={Redo2}
          label={t.actions.redo}
          disabled={!canRedo}
          onClick={() => store().redo()}
        />
        <Divider />
        <ToolButton
          icon={RotateCw}
          label={t.actions.rotate}
          disabled={!hasComponent}
          onClick={() => store().rotateSelected()}
        />
        <ToolButton
          icon={Trash2}
          label={t.actions.remove}
          disabled={!hasSelection}
          onClick={() => store().removeSelected()}
        />
        <ToolButton
          icon={SquareDashedMousePointer}
          label={t.actions.selectMode}
          pressed={selectMode}
          onClick={onToggleSelectMode}
        />
        <Divider />
        <ToolButton icon={ZoomIn} label={t.actions.zoomIn} onClick={() => void zoomIn()} />
        <ToolButton icon={ZoomOut} label={t.actions.zoomOut} onClick={() => void zoomOut()} />
        <ToolButton icon={Maximize} label={t.actions.fit} onClick={fit} />
      </div>
    </Panel>
  );
}
