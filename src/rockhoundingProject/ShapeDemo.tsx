import React, { useState } from "react";
import AmorphousShape from "./AmorphousShape";

const ShapeDemo = () => {
  const [size, setSize] = useState(100);
  const [jaggedness, setJaggedness] = useState(20);
  const [lumpiness, setLumpiness] = useState(5);

  return (
    <div>
      <AmorphousShape
        size={size}
        jaggedness={jaggedness}
        lumpiness={lumpiness}
      />
      <label>
        Size:{" "}
        <input
          type='range'
          min={50}
          max={200}
          value={size}
          onChange={(e) => setSize(+e.target.value)}
        />
      </label>
      <label>
        Jaggedness:{" "}
        <input
          type='range'
          min={0}
          max={50}
          value={jaggedness}
          onChange={(e) => setJaggedness(+e.target.value)}
        />
      </label>
      <label>
        Lumpiness:{" "}
        <input
          type='range'
          min={1}
          max={20}
          value={lumpiness}
          onChange={(e) => setLumpiness(+e.target.value)}
        />
      </label>
    </div>
  );
};

export default ShapeDemo;
