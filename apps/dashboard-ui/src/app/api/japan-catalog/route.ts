import { NextResponse } from "next/server";

const FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";
const JAPAN_BOUNDS = { minLatitude: 24, maxLatitude: 46, minLongitude: 122, maxLongitude: 154 };

type CatalogEvent = {
  id: string;
  magnitude: number;
  place: string;
  time: number;
  latitude: number;
  longitude: number;
  depthKm: number;
  url: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function parseEvent(feature: unknown): CatalogEvent | null {
  if (!isRecord(feature) || !isRecord(feature.properties) || !isRecord(feature.geometry)) {
    return null;
  }
  const { id, properties, geometry } = feature;
  const coordinates = geometry.coordinates;
  const eventUrl = properties.url;
  if (
    typeof id !== "string" ||
    typeof properties.mag !== "number" ||
    !Number.isFinite(properties.mag) ||
    typeof properties.place !== "string" ||
    typeof properties.time !== "number" ||
    !Number.isSafeInteger(properties.time) ||
    !isFiniteNumberArray(coordinates) ||
    coordinates.length < 3 ||
    typeof eventUrl !== "string"
  ) {
    return null;
  }
  const [longitude, latitude, depthKm] = coordinates;
  if (
    latitude < JAPAN_BOUNDS.minLatitude ||
    latitude > JAPAN_BOUNDS.maxLatitude ||
    longitude < JAPAN_BOUNDS.minLongitude ||
    longitude > JAPAN_BOUNDS.maxLongitude
  ) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(eventUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "earthquake.usgs.gov") {
    return null;
  }

  return {
    id,
    magnitude: properties.mag,
    place: properties.place,
    time: properties.time,
    latitude,
    longitude,
    depthKm,
    url: url.toString(),
  };
}

export async function GET() {
  try {
    const response = await fetch(FEED_URL, {
      headers: { Accept: "application/geo+json, application/json" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.error("USGS catalog returned a non-success status", response.status);
      return NextResponse.json(
        { error: "The external earthquake catalog is temporarily unavailable." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const payload: unknown = await response.json();
    if (
      !isRecord(payload) ||
      !isRecord(payload.metadata) ||
      typeof payload.metadata.generated !== "number" ||
      !Number.isSafeInteger(payload.metadata.generated) ||
      !Array.isArray(payload.features)
    ) {
      console.error("USGS catalog response did not match the expected GeoJSON shape");
      return NextResponse.json(
        { error: "The external earthquake catalog returned an unsupported response." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const events = payload.features
      .map(parseEvent)
      .filter((event): event is CatalogEvent => event !== null)
      .sort((left, right) => right.time - left.time)
      .slice(0, 30);

    return NextResponse.json(
      {
        source: "USGS Earthquakes, Past Hour GeoJSON feed",
        sourceUrl: FEED_URL,
        fetchedAt: Date.now(),
        feedGeneratedAt: payload.metadata.generated,
        count: events.length,
        events,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to retrieve the USGS earthquake catalog", error);
    return NextResponse.json(
      { error: "Unable to reach the external earthquake catalog. Retry shortly." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
