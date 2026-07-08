export default function StatsCards({ summary, agentCount }) {
    return (
      <div className="admin-section">
        <div className="admin-section-title">Live Overview</div>
        <div className="stat-cards">
          <div className="stat-card stat-card-accent">
            <div className="stat-card-value">{summary?.inProgress ?? 0}</div>
            <div className="stat-card-label">Orders in progress</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value">{agentCount}</div>
            <div className="stat-card-label">Agents online</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value">{summary?.totalToday ?? 0}</div>
            <div className="stat-card-label">Orders today</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value">
              {summary?.avgDeliveryMinutes ?? 0}m
            </div>
            <div className="stat-card-label">Avg delivery time</div>
          </div>
        </div>
      </div>
    );
  }