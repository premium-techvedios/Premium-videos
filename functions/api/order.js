
export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();

    const video = String(data.video || "").slice(0, 100);
    const price = Number(data.price);
    const phone = String(data.phone || "").slice(0, 20);
    const trxid = String(data.trxid || "").slice(0, 50);

    if (!video || !phone || !trxid || !Number.isFinite(price) || price <= 0) {
      return Response.json(
        { success: false, message: "সব তথ্য সঠিকভাবে দিন।" },
        { status: 400 }
      );
    }

    const message =
      "নতুন ভিডিও অর্ডার\n\n" +
      "ভিডিও: " + video + "\n" +
      "মূল্য: ৳" + price + "\n" +
      "ক্রেতার নম্বর: " + phone + "\n" +
      "Transaction ID: " + trxid + "\n\n" +
      "পেমেন্ট এখনো যাচাই করা হয়নি। bKash অ্যাপে যাচাই করুন।";

    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: message
        })
      }
    );

    if (!response.ok) {
      return Response.json(
        { success: false, message: "Telegram-এ মেসেজ পাঠানো যায়নি।" },
        { status: 502 }
      );
    }

    return Response.json({ success: true });

  } catch (error) {
    return Response.json(
      { success: false, message: "অর্ডার পাঠানো যায়নি।" },
      { status: 500 }
    );
  }
}
