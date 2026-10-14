import { useScenarioStore } from '@/store';
import { StepPanel } from './StepPanel';
import { SummaryDialog } from './SummaryDialog';
import './scenarios.css';

/** Panel langkah selama skenario berjalan, lalu ringkasan nilai setelah selesai. */
export function ScenarioLayer() {
  const run = useScenarioStore((state) => state.run);
  if (!run) return null;
  return run.finishedAtMs === undefined ? <StepPanel run={run} /> : <SummaryDialog run={run} />;
}
