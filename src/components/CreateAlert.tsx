import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const TRAINS = ["T100","T200","T300","T400","T500","T600","OTHER"];

export function CreateAlert() {
  const [train, setTrain] = useState("T100");
  const [tag, setTag] = useState("");
  const [priority, setPriority] = useState("P2");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    setLoading(true);

    const { error } = await supabase.from("equipment_alerts").insert({
      tag: tag || null,
      train,
      priority,
      description,
      status: "OPEN",
    });

    setLoading(false);

    if (error) alert(error.message);
    else alert("Alert created");
  };

  return (
    <div className="p-4 space-y-3">
      <select value={train} onChange={(e) => setTrain(e.target.value)} className="w-full border p-2">
        {TRAINS.map(t => <option key={t}>{t}</option>)}
      </select>

      <input
        placeholder="Equipment tag"
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        className="w-full border p-2"
      />

      <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full border p-2">
        <option value="P1">P1 - Critical</option>
        <option value="P2">P2 - Warning</option>
        <option value="P3">P3 - Info</option>
      </select>

      <textarea
        placeholder="Describe issue..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full border p-2"
      />

      <Button onClick={create} disabled={loading} className="w-full">
        {loading ? "Saving..." : "Create Alert"}
      </Button>
    </div>
  );
}
