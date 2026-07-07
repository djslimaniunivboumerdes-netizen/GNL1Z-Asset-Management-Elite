// src/pages/ProcessFlow.tsx
import React, { useState, useEffect } from 'react';
import { Play, Pause, AlertTriangle, Gauge, ThermometerSun, ArrowRightCircle } from 'lucide-react';
import processNodes, { ProcessNode } from '../data/process_nodes';
import { DCS_PANELS } from '../data/dcs_panels';
import gnl1zDatabase from '../data/gnl1z_database.json';

const ProcessFlow = () => {
  const [isAnimating, setIsAnimating] = useState(true);
  const [selectedNode, setSelectedNode] = useState<ProcessNode | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<any>(null);
  const [liveKPIs, setLiveKPIs] = useState({
    co2Removal: 99.85,
    lngProduction: 1280,
    feedFlow: 1850,
    liquefactionTemp: -161.5,
    overallEfficiency: 96.8,
  });

  // Simulate live data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveKPIs(prev => ({
        ...prev,
        co2Removal: Math.max(99.5, prev.co2Removal + (Math.random() - 0.5) * 0.2),
        lngProduction: Math.floor(1260 + Math.random() * 45),
        liquefactionTemp: parseFloat((-162 + Math.random() * 1.2).toFixed(1)),
      }));
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen w-full bg-gray-950 text-white overflow-hidden flex flex-col">
      {/* Top Bar */}
      <div className="bg-black/90 border-b border-cyan-500 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center">
            <span className="text-black font-bold">GL1Z</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-cyan-400">GL1Z LNG DIGITAL TWIN</h1>
            <p className="text-sm text-gray-400">Sonatrach Arzew - Process Flow Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-8 text-sm">
          <div className="flex gap-8">
            <div>
              <span className="text-gray-400">CO₂ Removal:</span>
              <span className="ml-2 font-mono text-emerald-400 text-xl">{liveKPIs.co2Removal}%</span>
            </div>
            <div>
              <span className="text-gray-400">LNG Production:</span>
              <span className="ml-2 font-mono text-emerald-400 text-xl">{liveKPIs.lngProduction} t/h</span>
            </div>
            <div>
              <span className="text-gray-400">Feed Gas:</span>
              <span className="ml-2 font-mono">{liveKPIs.feedFlow} MMSCFD</span>
            </div>
          </div>

          <button
            onClick={() => setIsAnimating(!isAnimating)}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 rounded-xl transition-colors"
          >
            {isAnimating ? <Pause size={20} /> : <Play size={20} />}
            <span>{isAnimating ? 'Pause' : 'Play'} Animation</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR - Equipment Hierarchy */}
        <div className="w-72 bg-gray-900 border-r border-gray-700 p-5 overflow-auto">
          <h3 className="text-cyan-400 font-semibold mb-4 flex items-center gap-2">
            <ArrowRightCircle size={18} /> EQUIPMENT HIERARCHY
          </h3>
          
          {Object.entries(gnl1zDatabase.sections || {}).map(([section, equipment]) => (
            <div key={section} className="mb-6">
              <div className="text-amber-400 font-medium mb-2 uppercase text-sm tracking-widest">
                {section}
              </div>
              <ul className="space-y-1 text-sm">
                {(equipment as any[]).slice(0, 7).map((eq: any) => (
                  <li
                    key={eq.tag}
                    className="cursor-pointer hover:bg-gray-800 px-3 py-1.5 rounded-lg transition-colors flex justify-between"
                    onClick={() => setSelectedNode(eq)}
                  >
                    <span>{eq.tag}</span>
                    <span className="text-gray-500 text-xs">{eq.description?.substring(0, 22)}...</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* MAIN PFD AREA */}
        <div className="flex-1 relative bg-[#05080f] overflow-auto p-6">
          <div className="relative max-w-[1450px] mx-auto">
            {/* Main PFD Background - Use your uploaded image */}
            <img
              src="/images/dcs/overall-plot-plan.png" 
              alt="GL1Z Overall Process Flow Diagram"
              className="w-full rounded-2xl shadow-2xl border border-gray-700"
            />

            {/* Refrigeration Loop Animation Overlay */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1450 680">
              <path
                d="M 420 280 Q 580 180 720 320 Q 850 420 980 280"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="5"
                strokeDasharray="15 10"
                className={isAnimating ? "animate-[flow_3s_linear_infinite]" : ""}
                opacity="0.7"
              />
              <circle cx="720" cy="320" r="12" fill="#eab308" className={isAnimating ? "animate-pulse" : ""} />
            </svg>

            {/* Clickable Equipment Nodes */}
            {processNodes.map((node) => (
              <div
                key={node.id}
                className="absolute flex flex-col items-center cursor-pointer group z-10"
                style={{ 
                  left: `${node.x}%`, 
                  top: `${node.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                onClick={() => setSelectedNode(node)}
              >
                <div className={`w-8 h-8 rounded-full border-4 border-white flex items-center justify-center transition-all group-hover:scale-125
                  ${node.status === 'running' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 
                    node.status === 'alarm' ? 'bg-yellow-500' : 'bg-red-500'}`}>
                  {node.type === 'pump' && '⚙️'}
                  {node.type === 'compressor' && '🔄'}
                  {node.type === 'column' && '🏛️'}
                  {node.type === 'vessel' && '🛢️'}
                </div>
                <div className="mt-1 bg-black/80 text-xs px-2 py-0.5 rounded text-center whitespace-nowrap">
                  {node.tag}
                </div>
                {node.status === 'running' && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-ping"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDEBAR - Details & DCS Panels */}
        <div className="w-96 bg-gray-900 border-l border-gray-700 overflow-auto">
          {selectedNode ? (
            <div className="p-6">
              <h2 className="text-2xl font-bold text-cyan-400 mb-1">{selectedNode.tag}</h2>
              <p className="text-gray-400 mb-6">{selectedNode.description}</p>

              <div className="bg-gray-800 rounded-xl p-5 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-gray-400">CURRENT STATUS</span>
                  <span className={`px-4 py-1 rounded-full text-sm font-medium ${
                    selectedNode.status === 'running' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {selectedNode.status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Pressure</div>
                    <div className="text-xl font-mono">42.8 bar</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Temperature</div>
                    <div className="text-xl font-mono">-42°C</div>
                  </div>
                </div>
              </div>

              <button 
                className="w-full bg-cyan-600 hover:bg-cyan-500 py-3 rounded-xl font-medium"
                onClick={() => window.open(`/equipment/${selectedNode.tag}`, '_blank')}
              >
                Open Full P&ID / Details →
              </button>
            </div>
          ) : (
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">DCS PANELS</h3>
              <div className="space-y-4">
                {dcsPanels.map((panel) => (
                  <div
                    key={panel.id}
                    className="bg-gray-800 hover:bg-gray-700 p-4 rounded-xl cursor-pointer transition-all"
                    onClick={() => setSelectedPanel(panel)}
                  >
                    <div className="font-medium">{panel.title}</div>
                    <div className="text-xs text-gray-400 mt-1">{panel.section}</div>
                    <div className="text-emerald-400 text-sm mt-2 font-mono">
                      {Object.values(panel.kpis)[0]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessFlow;
