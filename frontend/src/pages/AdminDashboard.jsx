import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAgentTracking } from "../hooks/useAgentTracking";
import AdminMap from "../components/admin/AdminMap";
import StatsCards from "../components/admin/StatsCards";
import OrdersChart from "../components/admin/OrdersChart";
import RecentOrders from "../components/admin/RecentOrders";
import AgentTable from "../components/admin/AgentTable";

const ORDER_SERVICE_URL = "http://localhost:8095";
const REFRESH_INTERVAL = 10000; // refresh stats every 10 seconds

export default function AdminDashboard() {
  const { agents, connected } = useAgentTracking();

  const [summary, setSummary] = useState(null);
  const [hourlyData, setHourlyData] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [clock, setClock] = useState(new Date());

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch stats
  const fetchStats = async () => {
    try {
      const [summaryRes, hourlyRes, recentRes] = await Promise.all([
        axios.get(`${ORDER_SERVICE_URL}/api/orders/stats/summary`),
        axios.get(`${ORDER_SERVICE_URL}/api/orders/stats/hourly`),
        axios.get(`${ORDER_SERVICE_URL}/api/orders/recent`),
      ]);
      setSummary(summaryRes.data);
      setHourlyData(hourlyRes.data);
      setRecentOrders(recentRes.data);
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const agentCount = Object.values(agents).filter(
    (a) => Date.now() - a.lastSeen < 10000
  ).length;

  return (
    <div className="admin-layout">

      {/* Left — Live Map */}
      <div className="admin-map">
        <AdminMap agents={agents} />
      </div>

      {/* Right — Stats Panel */}
      <div className="admin-panel">

        {/* Top Bar */}
        <button
        onClick={fetchStats}
        style={{
            background: "transparent",
            border: "1px solid #334155",
            borderRadius: "6px",
            color: "#64748b",
            fontSize: "11px",
            padding: "4px 8px",
            cursor: "pointer",
        }}
        >
        ↻ Refresh
        </button>
        <div className="admin-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              fontSize: "14px",
              fontWeight: "700",
              color: "#FF5200",
            }}>
              🛵 TrackFlow Admin
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              {clock.toLocaleTimeString()}
            </span>
            <span style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              color: connected ? "#22c55e" : "#ef4444",
            }}>
              <span style={{
                width: "6px", height: "6px",
                borderRadius: "50%",
                background: connected ? "#22c55e" : "#ef4444",
                display: "inline-block",
              }}/>
              {connected ? "Live" : "Disconnected"}
            </span>
            <Link
              to="/"
              style={{
                fontSize: "11px",
                color: "#64748b",
                textDecoration: "none",
                padding: "4px 8px",
                border: "1px solid #334155",
                borderRadius: "6px",
              }}
            >
              Customer View
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <StatsCards summary={summary} agentCount={agentCount} />

        {/* Hourly Chart */}
        <OrdersChart data={hourlyData} />

        {/* Recent Orders */}
        <RecentOrders orders={recentOrders} />

        {/* Agent Table */}
        <AgentTable agents={agents} />

      </div>
    </div>
  );
}