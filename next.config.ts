import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 (local) et libsql (Turso, via @libsql/client) sont des modules natifs :
  // on les exclut du bundling webpack pour que Vercel les résolve tels quels au runtime
  // depuis node_modules, avec leur binaire natif par plateforme.
  serverExternalPackages: ["better-sqlite3", "libsql"],
};

export default nextConfig;
