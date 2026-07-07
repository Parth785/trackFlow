package com.trackflow.order_service.service;

import com.trackflow.order_service.dto.OrderResponse;
import com.trackflow.order_service.dto.PlaceOrderRequest;
import com.trackflow.order_service.kafka.OrderEventProducer;
import com.trackflow.order_service.model.Location;
import com.trackflow.order_service.model.Order;
import com.trackflow.order_service.model.OrderStatus;
import com.trackflow.order_service.repository.OrderRepository;
import com.trackflow.order_service.service.AgentAssignmentService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final AgentAssignmentService agentAssignmentService;
    private final OrderEventProducer orderEventProducer;

    public OrderResponse placeOrder(PlaceOrderRequest request) {

        // Find nearest agent from Redis GEO
        String agentId = agentAssignmentService.findNearestAvailableAgent(
                request.getPickupLat(),
                request.getPickupLng()
        );

        if (agentId == null) {
            throw new RuntimeException("No agents available near your location");
        }

        // Build and save the order
        Order order = Order.builder()
                .customerId(request.getCustomerId())
                .agentId(agentId)
                .pickupLocation(Location.builder()
                        .lat(request.getPickupLat())
                        .lng(request.getPickupLng())
                        .address(request.getPickupAddress())
                        .build())
                .dropLocation(Location.builder()
                        .lat(request.getDropLat())
                        .lng(request.getDropLng())
                        .address(request.getDropAddress())
                        .build())
                .status(OrderStatus.ASSIGNED)
                .placedAt(LocalDateTime.now())
                .assignedAt(LocalDateTime.now())
                .build();

        Order saved = orderRepository.save(order);

        // Publish to Kafka
        orderEventProducer.publishOrderAssigned(
                saved.getId(),
                agentId,
                request.getPickupLat(), request.getPickupLng(),
                request.getDropLat(), request.getDropLng()
        );

        log.info("Order {} placed and assigned to agent {}", saved.getId(), agentId);
        return toResponse(saved);
    }

    public OrderResponse getOrder(String orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found: " + orderId));
        return toResponse(order);
    }

    public List<OrderResponse> getOrdersByCustomer(String customerId) {
        return orderRepository.findByCustomerId(customerId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private OrderResponse toResponse(Order order) {
        return OrderResponse.builder()
                .id(order.getId())
                .customerId(order.getCustomerId())
                .agentId(order.getAgentId())
                .pickupLocation(order.getPickupLocation())
                .dropLocation(order.getDropLocation())
                .status(order.getStatus())
                .placedAt(order.getPlacedAt())
                .build();
    }
}