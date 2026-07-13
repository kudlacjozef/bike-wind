# BikeWind

BikeWind compares the wind along saved GPX cycling routes in both directions, helping you choose what to ride and which way to go.

**Open BikeWind:** [kudlacjozef.github.io/bike-wind](https://kudlacjozef.github.io/bike-wind/)

## Use

1. Import GPX routes and choose favorites.
2. Select **Now** or a later start time, set your average speed, and compare.
3. Open a result to inspect wind on the map and interactive elevation profile.

Routes use their GPX filename. Reverse directions are labelled `<name> reverse`.

## Access

BikeWind works in current browsers on iPhone, iPad, Android, Windows, macOS, Linux, and Chromebook.

On iPhone or iPad, open it in Safari and choose **Share → Add to Home Screen**. Other supported browsers may offer **Install app** or **Add to Home screen**.

## Privacy

BikeWind is client-only. GPX routes stay in browser storage on the device. Wind forecasts come directly from [Open-Meteo](https://open-meteo.com/), and map tiles come from [OpenStreetMap](https://www.openstreetmap.org/). Forecasts and maps require an internet connection.

## Development

Node.js 20 or newer is recommended.

```bash
npm install
npm run dev
```

```bash
npm test
npm run build
```

Pushes to `main` are tested, built, and deployed to GitHub Pages automatically.
