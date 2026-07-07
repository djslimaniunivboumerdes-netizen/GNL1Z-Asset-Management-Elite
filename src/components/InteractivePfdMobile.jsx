import React, { useState } from 'react';
import './InteractivePfdMobile.css';
import React, { useState } from 'react';
import './InteractivePfdMobile.css';

const processSections = {
  decarbonatation: {
    title: "Décarbonatation (Absorber)",
    equipments: ["X01-F-502", "X01-E-506"]
  },
  regenerationMea: {
    title: "Régénération MEA",
    equipments: ["X01-F-501", "X01-E-502", "X01-G-507", "X01-E-505"]
  },
  deshydratation: {
    title: "Déshydratation",
    equipments: ["X01-E-521"]
  },
  demercurisation: {
    title: "Démercurisation",
    equipments: ["X01-F-503"]
  },
  refroidissement: {
    title: "Système de Refroidissement",
    equipments: ["X01-E-504"]
  },
  fractionnement: {
    title: "Fractionnement",
    equipments: ["X01-G-502"]
  }
};

export default function InteractivePfdMobile({ driveFiles = [] }) {
  const [activeSection, setActiveSection] = useState('regenerationMea');
  const [selectedEquipment, setSelectedEquipment] = useState('X01-E-505');

  // Looser string matching to catch folder typos like "F501" or "E 505" on Drive
  const normalize = (str) => str ? str.toUpperCase().replace(/X01/g, '').replace(/[\s-_]/g, '') : '';

  const openIsolationPlan = (tag) => {
    const target = normalize(tag);
    const matchedFile = driveFiles.find(f => normalize(f.name).includes(target));

    if (matchedFile) {
      // Opens seamlessly in the Google Drive App or mobile browser
      window.open(matchedFile.webViewLink, '_blank');
    } else {
      alert(`Plan for ${tag} not found in this folder. Check for naming variations.`);
    }
  };

  return (
    <div className="mobile-pfd-container">
      <h3 className="section-title">GNL1Z Process Controls</h3>
      
      {/* 1. Zoomable/Scrollable Image Container for Mobile view */}
      <div className="mobile-image-scroll">
        <img 
          src="/assets/schema_procede_gl1z.png" 
          alt="Process Flow Diagram" 
          className="mobile-pfd-img"
        />
        <div className="scroll-hint">↔ Swipe to view full diagram ↔</div>
      </div>

      {/* 2. Touch-Friendly Navigation Loops */}
      <div className="loop-grid">
        {Object.keys(processSections).map((key) => (
          <button
            key={key}
            className={`loop-tab-btn ${activeSection === key ? 'active' : ''}`}
            onClick={() => {
              setActiveSection(key);
              setSelectedEquipment(processSections[key].equipments[0]);
            }}
          >
            {processSections[key].title}
          </button>
        ))}
      </div>

      {/* 3. Dedicated Equipment Page Panel & Isolation Action */}
      <div className="mobile-action-card">
        <h4>{processSections[activeSection].title} Units</h4>
        
        <div className="radio-group">
          {processSections[activeSection].equipments.map((eq) => (
            <label key={eq} className={`radio-label ${selectedEquipment === eq ? 'checked' : ''}`}>
              <input
                type="radio"
                name="equipment-selector"
                value={eq}
                checked={selectedEquipment === eq}
                onChange={() => setSelectedEquipment(eq)}
              />
              <span className="custom-radio-text">{eq}</span>
            </label>
          ))}
        </div>

        <button 
          className="mobile-isolation-btn"
          onClick={() => openIsolationPlan(selectedEquipment)}
        >
          📂 Open Isolation Plan for {selectedEquipment}
        </button>
      </div>
    </div>
  );
      }
