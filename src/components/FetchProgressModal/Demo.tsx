import React, { useState } from "react";
import FetchProgressModal from "./FetchProgressModal";

export default function Demo() {
  const [show, setShow] = useState(false);

  return (
    <div>
      <button onClick={() => setShow(true)}>Start simulated request</button>

      {show && (
        <FetchProgressModal
          title="Processing…"
          simulate // no real action; modal simulates
          modeSec={40}
          maxSec={500}
          timeoutRandom   // <— enable random timeout
          timeoutMedianSec={40}
          timeoutMinSec={3.5}
          timeoutMaxSec={500}
          onSuccess={() => {
            setShow(false);
            alert("Success!");
          }}
          onError={() => setShow(false)}
        />
      )}
    </div>
  );
}
