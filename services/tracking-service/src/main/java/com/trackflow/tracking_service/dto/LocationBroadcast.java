package com.trackflow.tracking_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LocationBroadcast {
    private String agentId;
    private double lat;
    private double lng;
    private double bearing;
    private long timestamp;
}