package com.trackflow.order_service.repository;

import com.trackflow.order_service.model.Order;
import com.trackflow.order_service.model.OrderStatus;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface OrderRepository extends MongoRepository<Order, String> {
    List<Order> findByCustomerId(String customerId);
    List<Order> findByAgentId(String agentId);
    List<Order> findByStatus(OrderStatus status);
}