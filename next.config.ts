import type { NextConfig } from "next";

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
};

export default config;
