package com.trackflow.order_service.dto;

import lombok.Data;

@Data
public class PlaceOrderRequest {
    private String customerId;
    private double pickupLat;
    private double pickupLng;
    private String pickupAddress;
    private double dropLat;
    private double dropLng;
    private String dropAddress;
}