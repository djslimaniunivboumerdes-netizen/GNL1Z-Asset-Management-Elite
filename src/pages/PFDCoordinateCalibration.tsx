import { useEffect, useState } from "react";
import { extractTagCoordinates } from "@/utils/extractTagCoordinates";
import { useState, useRef } from "react";

export default function PFDCoordinateCalibration() {
  const [tags, setTags] = useState<any[]>([]);

  useEffect(() => {
    extractTagCoordinates("/pfd/gnl1z-pfd-labeled.png")
      .then(setTags);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <img
        src="/pfd/gnl1z-pfd-labeled.png"
        style={{ width: "100%" }}
      />

      {tags.map(tag => (
        <div
          key={tag.text}
          style={{
            position: "absolute",
            left: tag.x,
            top: tag.y,
            background: "red",
            color: "white",
            padding: 2,
            fontSize: 10
          }}
        >
          {tag.text}
        </div>
      ))}
    </div>
  );
}
