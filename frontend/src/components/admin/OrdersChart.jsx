import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, Cell
  } from "recharts";
  
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div style={{
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "8px",
          padding: "8px 12px",
          fontSize: "12px",
          color: "#e2e8f0",
        }}>
          <div style={{ color: "#64748b", marginBottom: "4px" }}>{label}</div>
          <div><span style={{ color: "#FF5200", fontWeight: "700" }}>
            {payload[0].value}
          </span> orders</div>
        </div>
      );
    }
    return null;
  };
  
  export default function OrdersChart({ data }) {
    if (!data || data.length === 0) return null;
  
    const maxVal = Math.max(...data.map(d => d.orders), 1);
  
    return (
      <div className="admin-section">
        <div className="admin-section-title">Orders Per Hour</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="hour"
              tick={{ fill: "#475569", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={2}
            />
            <YAxis
              tick={{ fill: "#475569", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }}/>
            <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.orders === maxVal ? "#FF5200" : "#334155"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }