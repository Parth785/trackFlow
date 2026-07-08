export default function RecentOrders({ orders }) {
    if (!orders || orders.length === 0) {
      return (
        <div className="admin-section">
          <div className="admin-section-title">Recent Orders</div>
          <div style={{ color: "#475569", fontSize: "12px" }}>
            No orders yet today
          </div>
        </div>
      );
    }
  
    return (
      <div className="admin-section">
        <div className="admin-section-title">Recent Orders</div>
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Agent</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td style={{ color: "#e2e8f0", fontFamily: "monospace" }}>
                  #{order.id.slice(-6)}
                </td>
                <td>{order.agentId?.replace("sim-", "") ?? "—"}</td>
                <td>
                  <span className={`status-badge ${order.status}`}>
                    {order.status}
                  </span>
                </td>
                <td>
                  {order.placedAt
                    ? new Date(order.placedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }