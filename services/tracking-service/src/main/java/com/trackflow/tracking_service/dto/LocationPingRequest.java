package com.trackflow.tracking_service.dto;

import lombok.Data;

@Data
public class LocationPingRequest {
    private String agentId;
    private double lat;
    private double lng;
    private double bearing;
    private long timestamp;
}