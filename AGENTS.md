# BikeWind working agreement

- Keep the application fully client-side. Do not add a backend, authentication, or cloud storage without explicit approval.
- Do not introduce an API key. Wind data comes directly from Open-Meteo.
- Keep TypeScript strict and domain calculations separate from React components.
- Add or update tests for route geometry, sampling, and wind calculations.
- Optimize the interface for iPhone Safari and keep it installable as a Progressive Web App.
- Preserve GPX privacy: routes remain in browser storage and are not uploaded.
- Run `npm test` and `npm run build` after functional changes.
- Do not replace the libraries or architecture without explaining why.

