package com.trackflow.order_service.dto;

import com.trackflow.order_service.model.Location;
import com.trackflow.order_service.model.OrderStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class OrderResponse {
    private String id;
    private String customerId;
    private String agentId;
    private Location pickupLocation;
    private Location dropLocation;
    private OrderStatus status;
    private LocalDateTime placedAt;
}