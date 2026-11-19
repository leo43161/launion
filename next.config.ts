import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Exportación estática: Ferozo no tiene Node.js. La web queda en out/.
//   npm run build:dev → para probar en launionmuebles.com.ar/dev/ (out/ va a public_html/launion/dev/)
//   npm run build     → la versión final, en la raíz (out/ va a public_html/launion/)
// npm avisa qué script corre en npm_lifecycle_event: así no hace falta ninguna dependencia para elegir.
// trailingSlash: cada página queda como carpeta/index.html y Apache la sirve sin reglas.
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: process.env.npm_lifecycle_event === "build:dev" ? "/dev" : "",
  turbopack: { root: process.cwd() }, // hay otro package-lock.json más arriba (en la carpeta del usuario): sin esto Next lo toma como raíz
  // npm run local: next dev le pasa /api/index.php al PHP de localhost:8000. Así la API queda en la misma dirección que el panel
  // y se puede entrar también por la IP de la compu (http://<ip>:5057), desde ella o desde otra de la red
  ...(process.env.npm_lifecycle_event === "dev" && {
    allowedDevOrigins: Object.values(networkInterfaces()).flat().map((i) => i!.address),
    rewrites: async () => [{ source: "/api/index.php", destination: "http://localhost:8000/index.php" }],
  }),
};

export default config;
