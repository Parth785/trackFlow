package com.trackflow.order_service.controller;

import com.trackflow.order_service.dto.OrderResponse;
import com.trackflow.order_service.dto.PlaceOrderRequest;
import com.trackflow.order_service.model.Order;
import com.trackflow.order_service.repository.OrderRepository;
import com.trackflow.order_service.service.OrderService;
import com.trackflow.order_service.service.RouteService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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
}