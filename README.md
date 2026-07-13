# BikeWind

A private, mobile-first PWA that calculates the wind on your usual GPX bike routes when you want to leave now. It lists every selected route in both directions without scoring or ranking them.

## Run locally

Requirements: Node.js 18 or newer.

```bash
npm install
npm run dev
```

Open the local address shown in the terminal. Import GPX files on the **Routes** screen, then return to **Ride now** and compare the wind. Departure defaults to **Now**, or you can choose a later date and time within the next 7 days.

## Quality checks

```bash
npm test
npm run build
```

The production files are generated in `dist/` and can be served by any static HTTPS host.

## Use on iPhone

1. Deploy the contents through GitHub Pages or another static HTTPS host.
2. Open the site in Safari on the iPhone.
3. Tap Share, then **Add to Home Screen**.
4. Import GPX tracks from the Files picker.

The app itself works without a paid Apple developer account, certificate, native installation, or application server. Fresh wind results still need an internet connection.

## Data and privacy

GPX routes are parsed in the browser and stored in IndexedDB on that device. They are never sent to an application server. During a wind comparison, sampled coordinates are requested directly from [Open-Meteo](https://open-meteo.com/). Opening a result requests only the currently visible map tiles from [OpenStreetMap](https://www.openstreetmap.org/); the full GPX file is not uploaded. Both providers are attributed in the interface.

Safari can clear website storage, particularly under device storage pressure, so retain the original GPX files.

## Deployment

The included GitHub Actions workflow publishes `dist/` to GitHub Pages after a push to `main`. In the repository settings, select **GitHub Actions** as the Pages source.

See [SPEC.md](./SPEC.md) for product behavior and acceptance criteria.
