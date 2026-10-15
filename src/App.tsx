import { ReactFlowProvider } from '@xyflow/react';
import { Inspector } from '@/features/inspector';
import { ScenarioLayer } from '@/features/scenarios';
import { SimControls } from '@/features/sim-controls';
import { TopBar } from '@/features/top-bar';
import { Tray } from '@/features/tray';
import { Workbench } from '@/features/workbench';
import { useInspectorVisible, useUiStore } from '@/store';

// Tata letak 5 area (docs/UX.md §2.1): bilah atas, baki, meja kerja, inspeksi, kendali simulasi.
// Kolomnya diatur `.app-shell` di index.css: baki bisa dilipat, inspeksi hanya saat panel parameter
// dibuka (tombol di bilah atas) dan satu komponen terpilih.
// ReactFlowProvider membungkus semuanya karena baki dan bilah atas ikut mengendalikan kanvas.
export function App() {
  const trayCollapsed = useUiStore((state) => state.trayCollapsed);
  const hasInspector = useInspectorVisible();
  return (
    <ReactFlowProvider>
      <div
        className="app-shell"
        data-tray={trayCollapsed ? 'rail' : undefined}
        data-inspector={hasInspector || undefined}
      >
        <TopBar />
        <Tray />
        <Workbench />
        <Inspector />
        <SimControls />
        <ScenarioLayer />
      </div>
    </ReactFlowProvider>
  );
}
