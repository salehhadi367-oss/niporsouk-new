export default {
  async fetch(request, env) {
    return new Response("Backend Worker test OK", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};
