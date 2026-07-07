package com.trackflow.order_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.geo.Circle;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.GeoResults;
import org.springframework.data.geo.Metrics;
import org.springframework.data.geo.Point;
import org.springframework.data.redis.connection.RedisGeoCommands;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class AgentAssignmentService {

    private final RedisTemplate<String, String> redisTemplate;

    private static final String REDIS_GEO_KEY = "agents:live";
    private static final double SEARCH_RADIUS_KM = 10.0;

    public String findNearestAvailableAgent(double lat, double lng) {
        Point center = new Point(lng, lat);
        Distance radius = new Distance(SEARCH_RADIUS_KM, Metrics.KILOMETERS);
        Circle circle = new Circle(center, radius);

        RedisGeoCommands.GeoRadiusCommandArgs args = RedisGeoCommands
                .GeoRadiusCommandArgs
                .newGeoRadiusArgs()
                .includeDistance()
                .sortAscending()
                .limit(10);

        GeoResults<RedisGeoCommands.GeoLocation<String>> results =
                redisTemplate.opsForGeo()
                        .radius(REDIS_GEO_KEY, circle, args);

        if (results == null || results.getContent().isEmpty()) {
            log.warn("No agents found within {}km of ({}, {})", SEARCH_RADIUS_KM, lat, lng);
            return null;
        }

        // Return the closest agent found
        String agentId = results.getContent()
                .get(0)
                .getContent()
                .getName();

        log.info("Nearest agent found: {} for location ({}, {})", agentId, lat, lng);
        return agentId;
    }
}
