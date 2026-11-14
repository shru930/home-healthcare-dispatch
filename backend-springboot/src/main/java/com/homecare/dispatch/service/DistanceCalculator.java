package com.homecare.dispatch.service;

/** Great-circle distance and a simple urban travel-time estimate (used by the mock API and the fallback path). */
public final class DistanceCalculator {

    private static final double EARTH_RADIUS_M = 6_371_000;
    /** Roads are longer than the straight line; 1.35 is a typical urban detour factor. */
    public static final double ROAD_FACTOR = 1.35;
    /** Average city driving speed in metres per second (~28 km/h). */
    public static final double CITY_SPEED_MPS = 7.8;

    private DistanceCalculator() {}

    public static double haversineMeters(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
    }

    public static int roadMeters(double lat1, double lng1, double lat2, double lng2) {
        return (int) Math.round(haversineMeters(lat1, lng1, lat2, lng2) * ROAD_FACTOR);
    }

    public static int travelSeconds(int roadMeters) {
        return (int) Math.round(roadMeters / CITY_SPEED_MPS);
    }
}
