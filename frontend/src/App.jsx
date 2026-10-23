// src/App.jsx
import React, { useEffect, useState } from "react";

function App() {
  const [status, setStatus] = useState("checking...");

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8000";
    fetch(`${apiBase}/health`)
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((data) => {
        if (data.status === "ok") {
          setStatus("Backend: connected");
        } else {
          setStatus("Backend: offline");
        }
      })
      .catch(() => setStatus("Backend: offline"));
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold mb-4">BidReady AI</h1>
      <p className="text-xl" data-testid="backend-status">{status}</p>
    </div>
  );
}

export default App;

