// src/components/smart-flow/EquipmentSidebar.jsx
export const EquipmentSidebar = ({ equipment, onClose }) => {
  if (!equipment) return null;

  return (
    <div className="fixed top-16 right-0 h-[calc(100vh-64px)] w-80 bg-slate-900 border-l border-slate-800 text-slate-100 shadow-2xl z-50 transition-transform duration-300 transform translate-x-0 flex flex-col">
      
      {/* SIDEBAR HEADER PANEL */}
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
        <div>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {equipment.tag}
          </span>
          <h3 className="text-sm font-semibold text-slate-200 mt-1">{equipment.name}</h3>
        </div>
        <button 
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* COMPONENT OPERATIONAL telemetry VALUES */}
      <div className="p-4 flex-1 space-y-4 overflow-y-auto">
        
        {/* CURRENT LIVE ALARM STATUS */}
        <div>
          <label className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">Process Status</label>
          <div className="flex items-center gap-2 mt-1">
            <span className={`h-2.5 w-2.5 rounded-full ${equipment.status.includes('Alert') ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-sm font-medium">{equipment.status}</span>
          </div>
        </div>

        {/* DATA MATRIX ATTRIBUTES GRID */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-2.5 rounded bg-slate-950/50 border border-slate-800/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">Design Pressure</span>
            <span className="text-sm font-mono font-bold text-slate-300 mt-0.5 block">{equipment.pressure}</span>
          </div>
          <div className="p-2.5 rounded bg-slate-950/50 border border-slate-800/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">Core Temperature</span>
            <span className="text-sm font-mono font-bold text-slate-300 mt-0.5 block">{equipment.temp}</span>
          </div>
        </div>

        {/* PROCESS FLOW STREAM DETAILS */}
        <div className="pt-2">
          <label className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">Associated Stream Path</label>
          <div className="mt-1 px-3 py-2 rounded bg-slate-950 text-xs font-mono text-slate-400 border border-slate-800 flex items-center justify-between">
            <span>{equipment.stream}</span>
            <span className="text-emerald-500">→ Active Loop</span>
          </div>
        </div>

      </div>

      {/* QUICK OPERATIONAL LINK ACTION ARRAYS */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50 space-y-2">
        <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded transition-colors border border-slate-700">
          View Trend Analytics Chart
        </button>
        <button className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white rounded transition-colors shadow-lg shadow-emerald-900/20">
          Issue Maintenance Work Order
        </button>
      </div>

    </div>
  );
};
