import React, { useState, useEffect } from 'react';
import { ArrowRight, Play, Pause, AlertTriangle, Zap } from 'lucide-react';

const DigitalTwinDashboard: React.FC = () => {
  const [isRunning, setIsRunning] = useState(true);
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);
  const [kpis, setKpis] = useState({
    feedFlow: 850,
    co2Removal: 98.5,
    lngTemp: -162,
    powerConsumption: 42.3,
    efficiency: 92,
  });

  // Simulated live updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (isRunning) {
        setKpis(prev => ({
          ...prev,
          feedFlow: Math.floor(840 + Math.random() * 20),
          co2Removal: Math.max(97, prev.co2Removal + (Math.random() - 0.5) * 0.3),
        }));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const equipmentData = {
    '101-F502': { name: 'Feed Gas Inlet', status: 'normal', temp: 35, pressure: 65, desc: 'Natural gas from Hassi R\'Mel' },
    '101-G507': { name: 'Amine Contactor', status: 'normal', temp: 45, pressure: 62, desc: 'MEA CO2 Absorption (Section 1)' },
    '104-F07.11': { name: 'Regenerator', status: 'normal', temp: 125, pressure: 1.5, desc: 'MEA Regeneration' },
    '106-E05.20': { name: 'Main Cryogenic Exchanger', status: 'normal', temp: -150, pressure: 55, desc: 'Liquefaction Core' },
    // Add more from PFD...
  };

  const refrigerationLoop = [
    { id: 'K-502', name: 'MR Compressor HP', status: 'running' },
    { id: 'K-503', name: 'Propane Compressor', status: 'running' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 font-mono overflow-auto">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <span className="text-cyan-400">🌀</span> GL1Z LNG DIGITAL TWIN
            </h1>
            <p className="text-slate-400">Sonatrach GL1/Z - Integrated Train Process Flow • Live DCS View</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl ${isRunning ? 'bg-red-600' : 'bg-emerald-600'}`}
            >
              {isRunning ? <Pause size={20} /> : <Play size={20} />}
              {isRunning ? 'PAUSE SIM' : 'START SIM'}
            </button>
            <div className="text-right">
              <div className="text-emerald-400 text-sm">TRAIN STATUS</div>
              <div className="text-2xl font-bold text-emerald-400">ONLINE • STABLE</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Hierarchy + KPIs */}
          <div className="col-span-3 space-y-6">
            {/* KPIs */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Zap className="text-amber-400" /> Process KPIs</h3>
              <div className="space-y-4">
                {Object.entries(kpis).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="font-mono text-xl font-bold text-cyan-400">
                      {value}{key.includes('Temp') ? '°C' : key.includes('Flow') ? ' MMSCFD' : key.includes('Removal') ? '%' : ' MW'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment Hierarchy */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4">Equipment Hierarchy</h3>
              <div className="text-sm space-y-1 text-slate-300">
                <div className="pl-4 border-l-2 border-cyan-500">1. Pre-Treatment (MEA)</div>
                <div className="pl-8 text-emerald-400">• 101-F502 Feed Gas</div>
                <div className="pl-8 text-emerald-400">• 101-G507 Amine Contactor</div>
                <div className="pl-4 border-l-2 border-cyan-500 mt-4">2. Dehydration & Fractionation</div>
                <div className="pl-4 border-l-2 border-cyan-500 mt-4">3. Liquefaction (MR Cycle)</div>
                <div className="pl-4 border-l-2 border-cyan-500 mt-4">4. LNG Storage & Export</div>
              </div>
            </div>
          </div>

          {/* Main PFD Area */}
          <div className="col-span-6">
            <div className="bg-[#0a0f1c] border-2 border-slate-700 rounded-3xl p-8 relative overflow-hidden shadow-2xl h-[680px]">
              {/* Background PFD Image / SVG Overlay */}
              <img 
                src="/pfd/gnl1z-pfd-labeled.png" 
                alt="GL1Z PFD" 
                className="absolute inset-0 w-full h-full object-contain opacity-80"
              />

              {/* Interactive Overlays (example positions - adjust with real coords) */}
              <div className="absolute top-[25%] left-[12%] cursor-pointer group" onClick={() => setSelectedEquipment(equipmentData['101-F502'])}>
                <div className="w-5 h-5 bg-emerald-500 rounded-full animate-pulse ring-4 ring-emerald-400/30"></div>
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 text-xs px-3 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100">101-F502 FEED</div>
              </div>

              {/* Refrigeration Loop Animation */}
              <div className="absolute top-[45%] left-[55%] w-48 h-48 border border-dashed border-cyan-400/30 rounded-full animate-[spin_25s_linear_infinite]">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-cyan-400 font-bold tracking-widest">MR CYCLE</div>
              </div>

              {/* Flow Arrows */}
              <div className="absolute top-[35%] left-[28%] text-4xl text-cyan-400 animate-[ping_2s_infinite] opacity-70">→</div>
              <div className="absolute top-[52%] left-[65%] text-4xl text-amber-400 animate-[ping_2.5s_infinite] opacity-70 rotate-12">→</div>
            </div>
          </div>

          {/* Right Sidebar - Details & Interlocks */}
          <div className="col-span-3">
            {selectedEquipment ? (
              <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700 sticky top-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  {selectedEquipment.name}
                </h3>
                <div className="space-y-4 text-sm">
                  <div>Status: <span className="text-emerald-400 font-bold">NORMAL</span></div>
                  <div>Temperature: <span className="font-mono">{selectedEquipment.temp}°C</span></div>
                  <div>Pressure: <span className="font-mono">{selectedEquipment.pressure} bar</span></div>
                  <p className="text-slate-400 text-xs leading-relaxed">{selectedEquipment.desc}</p>
                </div>
                <button className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm">OPEN P&ID</button>
              </div>
            ) : (
              <div className="bg-slate-900/70 rounded-2xl p-8 border border-dashed border-slate-600 text-center text-slate-400">
                Click equipment on PFD for details
              </div>
            )}

            {/* Interlocks */}
            <div className="mt-6 bg-slate-900 rounded-2xl p-6 border border-rose-900/50">
              <h4 className="font-semibold text-rose-400 flex items-center gap-2 mb-4"><AlertTriangle size={18} /> Active Interlocks / ESD</h4>
              <ul className="text-xs space-y-2 text-slate-300">
                <li className="flex justify-between"><span>High CO₂ in Absorber Outlet</span><span className="text-emerald-400">OK</span></li>
                <li className="flex justify-between"><span>MEA Temp High</span><span className="text-amber-400">MONITOR</span></li>
                <li className="flex justify-between"><span>Refrigerant Surge Drum</span><span className="text-emerald-400">OK</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigitalTwinDashboard;
