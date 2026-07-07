export default function StatsPanel({ agents, connected }) {
    const agentList = Object.values(agents);
    const activeCount = agentList.filter(
      (a) => Date.now() - a.lastSeen < 10000
    ).length;
  
    return (
      <div className="stats-panel">
        <h2>TrackFlow</h2>
  
        <div className="stat-row">
          <span>Status</span>
          <span className="stat-value">
            <span className="status-dot" style={{
              background: connected ? "#22c55e" : "#ef4444"
            }}/>
            {connected ? "Live" : "Disconnected"}
          </span>
        </div>
  
        <div className="stat-row">
          <span>Active agents</span>
          <span className="stat-value">{activeCount}</span>
        </div>
  
        <div className="stat-row">
          <span>Total seen</span>
          <span className="stat-value">{agentList.length}</span>
        </div>
  
        <div className="stat-row">
          <span>Updates/sec</span>
          <span className="stat-value">~{agentList.length > 0 ? (agentList.length / 3).toFixed(1) : 0}</span>
        </div>
      </div>
    );
  }