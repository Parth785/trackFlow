export default function AgentTable({ agents }) {
    const agentList = Object.values(agents);
  
    if (agentList.length === 0) {
      return (
        <div className="admin-section">
          <div className="admin-section-title">Agent Status</div>
          <div style={{ color: "#475569", fontSize: "12px" }}>
            No agents online
          </div>
        </div>
      );
    }
  
    const getStatus = (agent) => {
      const secondsSinceLastSeen = (Date.now() - agent.lastSeen) / 1000;
      if (secondsSinceLastSeen > 15) return "OFFLINE";
      return "AVAILABLE";
    };
  
    return (
      <div className="admin-section">
        <div className="admin-section-title">Agent Status</div>
        <table className="orders-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Status</th>
              <th>Bearing</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {agentList.map((agent) => {
              const status = getStatus(agent);
              return (
                <tr key={agent.agentId}>
                  <td style={{ color: "#e2e8f0" }}>
                    {agent.agentId.replace("sim-", "")}
                  </td>
                  <td>
                    <span className={`agent-dot ${status}`}/>
                    <span style={{ fontSize: "11px" }}>{status}</span>
                  </td>
                  <td style={{ fontFamily: "monospace" }}>
                    {Math.round(agent.bearing ?? 0)}°
                  </td>
                  <td>
                    {new Date(agent.lastSeen).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }