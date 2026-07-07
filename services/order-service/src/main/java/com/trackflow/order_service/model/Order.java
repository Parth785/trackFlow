package com.trackflow.order_service.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "orders")
public class Order {

    @Id
    private String id;

    private String customerId;
    private String agentId;

    private Location pickupLocation;
    private Location dropLocation;

    private OrderStatus status;

    private LocalDateTime placedAt;
    private LocalDateTime assignedAt;
    private LocalDateTime deliveredAt;
}
