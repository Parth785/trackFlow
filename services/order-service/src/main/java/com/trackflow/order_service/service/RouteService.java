package com.trackflow.order_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RouteService {

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    public List<List<Double>> getRoute(
            double fromLat, double fromLng,
            double toLat, double toLng) {

        String url = String.format(
            "http://router.project-osrm.org/route/v1/driving/" +
            "%f,%f;%f,%f?overview=full&geometries=geojson",
            fromLng, fromLat, toLng, toLat
        );

        try {
            String response = restTemplate.getForObject(url, String.class);
            JsonNode root = objectMapper.readTree(response);
            JsonNode coordinates = root
                    .path("routes").get(0)
                    .path("geometry")
                    .path("coordinates");

            List<List<Double>> waypoints = new ArrayList<>();
            for (JsonNode coord : coordinates) {
                // OSRM returns [lng, lat] — flip to [lat, lng] for Leaflet
                List<Double> point = List.of(
                        coord.get(1).asDouble(),
                        coord.get(0).asDouble()
                );
                waypoints.add(point);
            }
            return waypoints;

        } catch (Exception e) {
            log.error("OSRM route fetch failed", e);
            return List.of(
                    List.of(fromLat, fromLng),
                    List.of(toLat, toLng)
            );
        }
    }
}