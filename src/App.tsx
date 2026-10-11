import { ReactFlowProvider } from '@xyflow/react';
import { Inspector } from '@/features/inspector';
import { SimControls } from '@/features/sim-controls';
import { TopBar } from '@/features/top-bar';
import { Tray } from '@/features/tray';
import { Workbench } from '@/features/workbench';

// Tata letak 5 area (docs/UX.md §2.1): bilah atas, baki, meja kerja, inspeksi, kendali simulasi.
// ReactFlowProvider membungkus semuanya karena baki dan bilah atas ikut mengendalikan kanvas.
export function App() {
  return (
    <ReactFlowProvider>
      <div className="grid h-full grid-cols-[var(--spacing-tray)_minmax(0,1fr)_var(--spacing-inspector)] grid-rows-[var(--spacing-topbar)_minmax(0,1fr)_var(--spacing-simbar)]">
        <TopBar />
        <Tray />
        <Workbench />
        <Inspector />
        <SimControls />
      </div>
    </ReactFlowProvider>
  );
}
