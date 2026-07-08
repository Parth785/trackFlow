package com.trackflow.order_service.controller;

import com.trackflow.order_service.dto.OrderResponse;
import com.trackflow.order_service.dto.PlaceOrderRequest;
import com.trackflow.order_service.model.Order;
import com.trackflow.order_service.model.OrderStatus;
import com.trackflow.order_service.repository.OrderRepository;
import com.trackflow.order_service.service.OrderService;
import com.trackflow.order_service.service.RouteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final OrderRepository orderRepository;
    private final RouteService routeService;
    private final RedisTemplate<String, String> redisTemplate;

    @PostMapping
    public ResponseEntity<OrderResponse> placeOrder(
            @RequestBody PlaceOrderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(orderService.placeOrder(request));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<OrderResponse> getOrder(
            @PathVariable String orderId) {
        return ResponseEntity.ok(orderService.getOrder(orderId));
    }

    @GetMapping("/customer/{customerId}")
    public ResponseEntity<List<OrderResponse>> getOrdersByCustomer(
            @PathVariable String customerId) {
        return ResponseEntity.ok(orderService.getOrdersByCustomer(customerId));
    }

    @GetMapping("/{orderId}/route")
    public ResponseEntity<Map<String, Object>> getOrderRoute(
            @PathVariable String orderId) {

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        org.springframework.data.geo.Point agentPoint =
                redisTemplate.opsForGeo()
                        .position("agents:live", order.getAgentId())
                        .get(0);

        double agentLat = agentPoint.getY();
        double agentLng = agentPoint.getX();

        List<List<Double>> agentToPickup = routeService.getRoute(
                agentLat, agentLng,
                order.getPickupLocation().getLat(),
                order.getPickupLocation().getLng()
        );

        List<List<Double>> pickupToDrop = routeService.getRoute(
                order.getPickupLocation().getLat(),
                order.getPickupLocation().getLng(),
                order.getDropLocation().getLat(),
                order.getDropLocation().getLng()
        );

        Map<String, Object> response = Map.of(
                "orderId", orderId,
                "agentId", order.getAgentId(),
                "agentToPickup", agentToPickup,
                "pickupToDrop", pickupToDrop,
                "pickupLocation", order.getPickupLocation(),
                "dropLocation", order.getDropLocation()
        );

        return ResponseEntity.ok(response);
    }
    @GetMapping("/stats/summary")
    public ResponseEntity<Map<String, Object>> getStatsSummary() {
        // Fetch all orders and filter in Java to avoid MongoDB date issues
        List<Order> allOrders = orderRepository.findAll();

        LocalDateTime startOfDay = LocalDateTime.now()
                .withHour(0).withMinute(0).withSecond(0).withNano(0);

        List<Order> todayOrders = allOrders.stream()
                .filter(o -> o.getPlacedAt() != null &&
                        o.getPlacedAt().isAfter(startOfDay))
                .toList();

        long totalToday = todayOrders.size();
        long delivered = todayOrders.stream()
                .filter(o -> o.getStatus() == OrderStatus.DELIVERED)
                .count();
        long inProgress = todayOrders.stream()
                .filter(o -> o.getStatus() == OrderStatus.ASSIGNED
                        || o.getStatus() == OrderStatus.PICKED_UP)
                .count();

        double avgDeliveryTime = todayOrders.stream()
                .filter(o -> o.getStatus() == OrderStatus.DELIVERED
                        && o.getDeliveredAt() != null
                        && o.getPlacedAt() != null)
                .mapToLong(o -> java.time.Duration.between(
                        o.getPlacedAt(), o.getDeliveredAt()).toMinutes())
                .average()
                .orElse(0);

        Map<String, Object> summary = new java.util.HashMap<>();
        summary.put("totalToday", totalToday);
        summary.put("delivered", delivered);
        summary.put("inProgress", inProgress);
        summary.put("avgDeliveryMinutes", Math.round(avgDeliveryTime));

        return ResponseEntity.ok(summary);
    }

    @GetMapping("/stats/hourly")
    public ResponseEntity<List<Map<String, Object>>> getHourlyStats() {
        List<Order> allOrders = orderRepository.findAll();

        LocalDateTime twelveHoursAgo = LocalDateTime.now().minusHours(12);

        List<Order> recentOrders = allOrders.stream()
                .filter(o -> o.getPlacedAt() != null &&
                        o.getPlacedAt().isAfter(twelveHoursAgo))
                .toList();

        Map<Integer, Long> byHour = recentOrders.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        o -> o.getPlacedAt().getHour(),
                        java.util.stream.Collectors.counting()
                ));

        // Build last 12 hours in correct order
        List<Map<String, Object>> hourly = new java.util.ArrayList<>();
        for (int i = 11; i >= 0; i--) {
            LocalDateTime hourTime = LocalDateTime.now().minusHours(i);
            int hour = hourTime.getHour();
            Map<String, Object> entry = new java.util.HashMap<>();
            entry.put("hour", String.format("%02d:00", hour));
            entry.put("orders", byHour.getOrDefault(hour, 0L));
            hourly.add(entry);
        }

        return ResponseEntity.ok(hourly);
    }

    @GetMapping("/recent")
    public ResponseEntity<List<OrderResponse>> getRecentOrders() {
        List<Order> recent = orderRepository
                .findTop10ByOrderByPlacedAtDesc();
        return ResponseEntity.ok(
                recent.stream().map(this::toResponse).toList()
        );
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
    
    @PatchMapping("/{orderId}/status")
    public ResponseEntity<Void> updateOrderStatus(
            @PathVariable String orderId,
            @RequestBody Map<String, String> request) {

        String status = request.get("status");
        log.info("Updating order {} status to {}", orderId, status);

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found: " + orderId));

        order.setStatus(OrderStatus.valueOf(status));

        if ("DELIVERED".equals(status)) {
            order.setDeliveredAt(LocalDateTime.now());
            log.info("Order {} delivered at {}", orderId, order.getDeliveredAt());
        }

        if ("PICKED_UP".equals(status)) {
            order.setAssignedAt(LocalDateTime.now());
        }

        orderRepository.save(order);
        log.info("Order {} saved with status {}", orderId, status);
        return ResponseEntity.ok().build();
    }
}