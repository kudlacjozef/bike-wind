# BikeWind product specification

## Purpose

BikeWind answers one question: **What will the wind be like on each of my usual bike routes if I leave now, in either direction?**

It is a personal, client-only iPhone web app. There is no account, backend, API key, route planner, or departure-time planning interface.

## Primary flow

1. Import one or more GPX tracks from Files.
2. Store the parsed tracks locally in IndexedDB.
3. Mark the standard tracks to compare as favorites.
4. Keep the default **Now** departure or choose a date and time within the next 7 days.
5. Set a usual average riding speed and calculate the wind.
6. Analyze every selected route in normal and reverse direction.
7. List every route in library order, with normal direction followed by reverse direction.
8. Open a result to see the wind-colored route and summary.

## Inputs

- Stored GPX route geometry.
- Favorite status.
- Average speed, default 24 km/h.
- Departure time, defaulting to the current time with an optional later date and time.

## Wind data

Use Open-Meteo's `/v1/forecast` endpoint directly from the browser with:

- `wind_speed_10m`
- `wind_direction_10m`
- `wind_gusts_10m`
- `wind_speed_unit=kmh`
- Unix timestamps

Coordinates are batched. The route is sampled at roughly 1 km intervals. Adjacent samples may still receive identical forecast values because weather-model grid resolution is coarser than 1 km in many locations.

For each route section, choose the forecast hour nearest the estimated arrival time:

```text
arrival = analysis start time + distance from start / average speed
```

For a later departure, the requested forecast window includes both the delay before departure and the longest selected ride.

## Wind mathematics

Weather data reports the direction the wind is coming **from**.

```text
windToward = (windFrom + 180°) mod 360°
relativeAngle = windToward - routeBearing
along = windSpeed × cos(relativeAngle)
cross = windSpeed × sin(relativeAngle)
```

- Positive `along`: tailwind.
- Negative `along`: headwind.
- Absolute `cross`: crosswind strength.

Summaries are distance-weighted. The app does not calculate an overall score or rank routes; it presents the wind information for the rider to judge.

## Result presentation

Each route-direction result shows:

- a miniature GPX route-shape icon and direction, with the imported route name retained in accessibility text and the detail screen;
- headwind, tailwind, and neutral/crosswind distance percentages;
- maximum forecast gust;
- distance and estimated ride duration;
- a chronological start-to-finish wind strip whose colour changes show the order of headwind, tailwind, and crosswind sections without a written sequence; coloured endpoint dots make the first and final riding conditions clear even on long routes;
- an interactive OpenStreetMap view using the complete original GPX geometry, colored green for tailwind, amber for crosswind, and red for headwind.
- repeated direction arrows and a small right-side offset so outbound and return passes remain distinguishable when they share the same road.
- blue wind-flow arrows at forecast samples; tapping one reveals speed, meteorological source direction, and gusts.
- wind-arrow size and shade encode cycling impact using the greater of sustained wind or 65% of gust speed: weak below 10 km/h, noticeable below 20, strong below 30, and very strong at 30 km/h or more.

## Privacy and offline behavior

- GPX coordinates are stored only in the browser's IndexedDB.
- Coordinates are sent to Open-Meteo only when the rider requests an analysis.
- Opening a result loads the visible map tiles directly from OpenStreetMap; the full GPX file is not uploaded.
- The application shell is cached for offline opening.
- A network connection is required for fresh wind results and map tiles.
- The user should keep the original GPX files because iOS may eventually clear website data.

## Acceptance criteria

- Imports GPX tracks and routes with at least two valid points.
- Persists imported tracks and favorite status after a restart.
- Evaluates each chosen track in both directions from the current time.
- Uses forecast conditions matched to progress along the route.
- Correctly identifies cardinal headwind, tailwind, and crosswind cases in tests.
- Builds as a static, installable PWA with no secret and no server component.
- Works in a narrow iPhone-sized viewport without horizontal scrolling.
