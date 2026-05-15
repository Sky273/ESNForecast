#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(process.cwd(), args.root ?? "apps/web/dist");
const port = Number(args.port ?? process.env.PORT ?? 5173);
const host = args.host ?? "0.0.0.0";
const indexFile = path.join(root, "index.html");

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

await ensureFile(indexFile);

const server = http.createServer(async (request, response) => {
  if (!request.url || (request.method !== "GET" && request.method !== "HEAD")) {
    sendText(response, 405, "Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    sendText(response, 400, "Bad request");
    return;
  }

  try {
    const filePath = await resolveRequestPath(pathname, request.headers.accept ?? "");
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(extension) ?? "application/octet-stream",
      "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error?.code === "ENOENT") {
      sendText(response, 404, "Not found");
      return;
    }
    if (error?.code === "EACCES") {
      sendText(response, 403, "Forbidden");
      return;
    }
    sendText(response, 500, "Internal server error");
  }
});

server.listen(port, host, () => {
  console.log(`Static web server ready: http://${host}:${port}`);
  console.log(`Serving: ${root}`);
});

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      continue;
    }
    const key = value.slice(2);
    parsed[key] = values[index + 1];
    index += 1;
  }
  return parsed;
}

async function resolveRequestPath(pathname, acceptHeader) {
  if (pathname.includes("\0")) {
    const error = new Error("Forbidden");
    error.code = "EACCES";
    throw error;
  }

  let filePath = path.resolve(root, `.${pathname}`);
  if (!isInsideRoot(filePath)) {
    const error = new Error("Forbidden");
    error.code = "EACCES";
    throw error;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      await ensureFile(filePath);
    }
    return filePath;
  } catch (error) {
    const wantsHtml = acceptHeader.includes("text/html") || !path.extname(pathname);
    if (wantsHtml) {
      return indexFile;
    }
    throw error;
  }
}

function isInsideRoot(filePath) {
  const relative = path.relative(root, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function ensureFile(filePath) {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) {
    throw new Error(`Expected file: ${filePath}`);
  }
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(message);
}
