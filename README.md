# BikeWind

BikeWind is a personal web app for deciding which familiar bike route to ride based on the wind. Import your GPX tracks once, choose **Now** or a later departure, and BikeWind calculates every selected route in both directions.

**Use the current version:** [kudlacjozef.github.io/bike-wind](https://kudlacjozef.github.io/bike-wind/)

BikeWind is a Progressive Web App (PWA). It runs entirely in the browser: there is no account, application server, or API key.

## Current features

- Imports one or more GPX tracks and keeps the original GPS detail for route maps.
- Stores routes locally on the device and lets you mark regular routes as favorites.
- Checks every selected track in its normal and reverse directions.
- Uses a wind sample approximately every 1 km and the forecast for the estimated time you reach that section.
- Starts with **Now** by default, with an optional departure time up to 7 days ahead.
- Uses your usual average speed to estimate progress along the ride.
- Shows tailwind and headwind percentages, maximum gust, and a start-to-finish color strip.
- Opens a detailed map colored by headwind, crosswind, and tailwind.
- Separates overlapping out-and-back lines and marks the direction of travel.
- Shows wind-flow arrows and distinguishes weak, noticeable, strong, and very strong riding wind.
- Includes a separate current-wind map covering roughly 100 km around your location.
- Reduces the number of visible regional arrows as you zoom, never below five. Existing arrows remain fixed and newly exposed areas fill as you move the map.

## Using BikeWind

1. Open **Routes** and import your usual GPX files.
2. Star the routes you want to include, or turn off **Favorites only** to use every route.
3. On **Ride now**, keep **Now** selected or choose a later date and time.
4. Set your usual average speed.
5. Tap **Compare wind**.
6. Review each normal and reverse direction in the order shown. Tap a result for its detailed map.

The regional **Show wind map** feature needs location permission. GPX route comparison does not need your live location because the coordinates come from the imported track.

## Access and installation

Installation is optional. BikeWind works directly from its web address in a current browser.

### iPhone or iPad

1. Open the [BikeWind website](https://kudlacjozef.github.io/bike-wind/) in Safari.
2. Use Safari's Share menu and choose **Add to Home Screen**.
3. Open BikeWind from the new Home Screen icon.
4. Import tracks through the Files picker.

No App Store installation, developer certificate, recurring payment, or periodic re-signing is required.

### Android phone or tablet

1. Open the [BikeWind website](https://kudlacjozef.github.io/bike-wind/) in Chrome or another current browser.
2. Use the browser menu's **Install app** or **Add to Home screen** option when available.
3. Alternatively, bookmark the site and use it as a normal web page.
4. Import GPX files from the device's file picker.

The exact installation wording depends on the browser. Direct browser access works even when an install option is not offered.

### Windows, macOS, Linux, or Chromebook

Open the [BikeWind website](https://kudlacjozef.github.io/bike-wind/) in a current desktop browser. Chrome and Edge can usually install it from the install icon or browser menu; other browsers can use it as a pinned tab or bookmark.

Routes are stored separately for each browser profile and device. Importing tracks on a phone does not automatically make them available on a computer, and private/incognito windows should not be used for permanent route storage.

### Self-hosted access

BikeWind consists only of static HTML, CSS, JavaScript, images, and a service worker. The production `dist/` folder can be served from any static HTTPS host. HTTPS is required for normal PWA installation and browser location access outside `localhost`.

## Data, privacy, and connectivity

- GPX files are parsed in the browser and stored in IndexedDB on that device. They are not uploaded to BikeWind or an application server.
- Route sample coordinates are requested directly from [Open-Meteo](https://open-meteo.com/) to retrieve wind speed, direction, and gust forecasts.
- The regional wind map sends its requested forecast coordinates to Open-Meteo. Your browser supplies location only after you grant permission.
- Opening a map requests visible tiles from [OpenStreetMap](https://www.openstreetmap.org/); the GPX file itself is not sent to OpenStreetMap.
- The installed app shell can reopen from its cache, but fresh wind forecasts and uncached map tiles require an internet connection.

Browser storage can be cleared manually or under device storage pressure, so keep the original GPX files as a backup.

## Run locally

Node.js 20 or newer is recommended.

```bash
npm install
npm run dev
```

Open the local address shown in the terminal. To preview the interface from another device on the same network, run:

```bash
npm run dev -- --host
```

Then open the displayed network address on that device. This development address uses plain HTTP, so the regional location map and PWA installation may be unavailable there; use an HTTPS deployment for a complete phone test.

## Tests and production build

```bash
npm test
npm run build
npm run preview
```

The production files are generated in `dist/`.

## GitHub Pages deployment

The included GitHub Actions workflow runs the tests, builds the app, and publishes `dist/` to GitHub Pages after every push to `main`. In the repository's Pages settings, the source must be set to **GitHub Actions**.

See [SPEC.md](./SPEC.md) for the original product behavior and acceptance criteria.
