export async function onRequest() {
  return Response.json({
    status: "ok",
    app: "GNL1Z Asset Management",
  });
}
