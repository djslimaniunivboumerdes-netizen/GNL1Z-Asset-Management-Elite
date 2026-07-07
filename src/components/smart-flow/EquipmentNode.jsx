// src/components/smart-flow/EquipmentNode.jsx
export const EquipmentNode = ({ name, tag, xPercent, yPercent, onControlClick }) => {
  return (
    <div 
      className="absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 group"
      style={{ top: `${yPercent}%`, left: `${xPercent}%` }}
    >
      {/* Visual Indicator / Component Button */}
      <button 
        onClick={onControlClick}
        className="h-10 w-10 rounded-full bg-slate-900 border-2 border-emerald-500 flex items-center justify-center transition-all group-hover:scale-110 shadow-lg"
      >
        <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
      </button>
      
      {/* Mechanically Linked Label Text */}
      <span className="mt-2 px-2 py-0.5 bg-slate-950/90 border border-slate-800 rounded text-[11px] font-mono text-slate-300 whitespace-nowrap shadow-md pointer-events-none">
        {tag} : {name}
      </span>
    </div>
  );
};
