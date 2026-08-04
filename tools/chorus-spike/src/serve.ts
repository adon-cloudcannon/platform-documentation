const PORT = 4507;
const ROOT = new URL("../demo/", import.meta.url).pathname;

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  png: "image/png",
};

console.log(`serving ${ROOT}`);
console.log(`  http://localhost:${PORT}/`);

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = ROOT + path.replace(/^\/+/, "");
  try {
    const file = await Deno.readFile(filePath);
    const ext = path.split(".").pop() ?? "";
    const type = MIME[ext] ?? "application/octet-stream";
    return new Response(file, { headers: { "content-type": type } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
});
