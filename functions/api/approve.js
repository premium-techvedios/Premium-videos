
function makeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();

    if (!env.ADMIN_PASSWORD ||
        data.password !== env.ADMIN_PASSWORD) {
      return Response.json(
        { success: false, message: "Admin Password ভুল।" },
        { status: 401 }
      );
    }

    const orderId = Number(data.orderId);

    if (!Number.isInteger(orderId) || orderId < 1) {
      return Response.json(
        { success: false, message: "সঠিক Order ID দিন।" },
        { status: 400 }
      );
    }

    const order = await env.DB.prepare(
      "SELECT id, video_id, status FROM orders WHERE id = ?"
    ).bind(orderId).first();

    if (!order) {
      return Response.json(
        { success: false, message: "অর্ডার পাওয়া যায়নি।" },
        { status: 404 }
      );
    }

    if (order.status !== "pending") {
      return Response.json(
        { success: false, message: "অর্ডারটি আগে থেকেই অনুমোদিত বা নিষ্পত্তি হয়েছে।" },
        { status: 409 }
      );
    }

    const token = makeToken();

    await env.DB.prepare(
      "INSERT INTO access_tokens (order_id, video_id, token) VALUES (?, ?, ?)"
    ).bind(order.id, order.video_id, token).run();

    await env.DB.prepare(
      "UPDATE orders SET status = 'approved' WHERE id = ? AND status = 'pending'"
    ).bind(order.id).run();

    const watchUrl =
      new URL(request.url).origin +
      "/watch.html?id=" + order.video_id +
      "&token=" + encodeURIComponent(token);

    return Response.json({
      success: true,
      message: "অর্ডার অনুমোদিত হয়েছে।",
      watchUrl: watchUrl
    });

  } catch (error) {
    return Response.json(
      { success: false, message: "অনুমোদন করতে সমস্যা হয়েছে।" },
      { status: 500 }
    );
  }
}
