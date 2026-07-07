// src/data/process_nodes.ts
export interface ProcessNode {
  id: string;
  tag: string;
  description: string;
  section: string;
  x: number;        // percentage
  y: number;        // percentage
  status: 'running' | 'standby' | 'alarm' | 'trip';
  type: 'vessel' | 'pump' | 'compressor' | 'exchanger' | 'column' | 'valve';
  kpi?: {
    pressure?: string;
    temperature?: string;
    flow?: string;
  };
}

export const processNodes: ProcessNode[] = [
  // Pretreatment / MEA Section
  { id: 'n1', tag: '101-F501', description: 'Feed Gas Inlet Separator', section: 'Pretreatment', x: 8, y: 35, status: 'running', type: 'vessel' },
  { id: 'n2', tag: '101-F502', description: 'Amine Contactor', section: 'Pretreatment', x: 12, y: 28, status: 'running', type: 'column' },
  { id: 'n3', tag: 'X01-J-503', description: 'MEA Solution Pump A', section: 'Pretreatment', x: 18, y: 42, status: 'running', type: 'pump' },
  { id: 'n4', tag: 'X01-E-502', description: 'Regenerator Reboiler', section: 'Pretreatment', x: 25, y: 48, status: 'running', type: 'exchanger' },

  // Dehydration & Fractionation
  { id: 'n5', tag: '102-R03.10', description: 'Molecular Sieve Dryer A', section: 'Dehydration', x: 35, y: 32, status: 'running', type: 'vessel' },
  { id: 'n6', tag: '107-F07.21', description: 'Demethanizer', section: 'Fractionation', x: 48, y: 55, status: 'running', type: 'column' },
  { id: 'n7', tag: '108-F07.31', description: 'Deethanizer', section: 'Fractionation', x: 52, y: 55, status: 'running', type: 'column' },
  { id: 'n8', tag: '109-F07.41', description: 'Depropanizer', section: 'Fractionation', x: 56, y: 55, status: 'running', type: 'column' },

  // Liquefaction (MCR Area)
  { id: 'n9', tag: '106-E05.20', description: 'Main Cryogenic Heat Exchanger', section: 'Liquefaction', x: 68, y: 25, status: 'running', type: 'exchanger' },
  { id: 'n10', tag: 'K-503', description: 'MR Compressor', section: 'Liquefaction', x: 75, y: 45, status: 'running', type: 'compressor' },
  { id: 'n11', tag: 'K-502', description: 'Propane Compressor', section: 'Liquefaction', x: 72, y: 52, status: 'running', type: 'compressor' },

  // Storage & Export
  { id: 'n12', tag: '105-K01.20', description: 'LNG Storage Tank A', section: 'Storage', x: 88, y: 35, status: 'running', type: 'vessel' },
  { id: 'n13', tag: '105-K01.21', description: 'LNG Storage Tank B', section: 'Storage', x: 92, y: 35, status: 'running', type: 'vessel' },
  { id: 'n14', tag: 'Export Jetty', description: 'LNG Loading Arm', section: 'Export', x: 95, y: 65, status: 'standby', type: 'valve' },

  // Utilities
  { id: 'n15', tag: 'Flare Stack', description: 'Flare System', section: 'Utilities', x: 82, y: 15, status: 'standby', type: 'vessel' },
];

export default processNodes;
