
export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();

    const videoNames = {
      "Premium Video 01": 1,
      "Premium Video 02": 2,
      "Premium Video 03": 3,
      "Premium Video 04": 4
    };

    const videoName = String(data.video || "").trim();
    const videoId = videoNames[videoName];
    const phone = String(data.phone || "").trim();
    const trxid = String(data.trxid || "").trim();

    if (!videoId || !/^01[3-9]\d{8}$/.test(phone) ||
        !/^[a-zA-Z0-9-]{5,50}$/.test(trxid)) {
      return Response.json(
        { success: false, message: "তথ্য সঠিকভাবে দিন।" },
        { status: 400 }
      );
    }

    const video = await env.DB.prepare(
      "SELECT id, title, price, active FROM videos WHERE id = ?"
    ).bind(videoId).first();

    if (!video || video.active !== 1) {
      return Response.json(
        { success: false, message: "ভিডিওটি পাওয়া যাচ্ছে না।" },
        { status: 404 }
      );
    }

    const existing = await env.DB.prepare(
      "SELECT id FROM orders WHERE trxid = ?"
    ).bind(trxid).first();

    if (existing) {
      return Response.json(
        { success: false, message: "এই Transaction ID আগে জমা দেওয়া হয়েছে।" },
        { status: 409 }
      );
    }

    const saved = await env.DB.prepare(
      `INSERT INTO orders (video_id, price, phone, trxid, status)
       VALUES (?, ?, ?, ?, 'pending')`
    ).bind(video.id, video.price, phone, trxid).run();

    const orderId = saved.meta.last_row_id;

    const message =
      "নতুন ভিডিও অর্ডার\n\n" +
      "অর্ডার নম্বর: " + orderId + "\n" +
      "ভিডিও: " + videoName + "\n" +
      "মূল্য: ৳" + video.price + "\n" +
      "ক্রেতার নম্বর: " + phone + "\n" +
      "Transaction ID: " + trxid + "\n\n" +
      "পেমেন্ট এখনো যাচাই করা হয়নি। bKash অ্যাপে যাচাই করুন।";

    let notificationSent = false;

    try {
      const telegramResponse = await fetch(
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

      const telegramResult = await telegramResponse.json();
      notificationSent = telegramResponse.ok && telegramResult.ok === true;
    } catch (error) {
      notificationSent = false;
    }

    return Response.json({
      success: true,
      orderId: orderId,
      message: notificationSent
        ? "অর্ডার জমা হয়েছে।"
        : "অর্ডার জমা হয়েছে, তবে Telegram নোটিফিকেশন পাঠানো যায়নি।"
    });

  } catch (error) {
    return Response.json(
      { success: false, message: "অর্ডার জমা দিতে সমস্যা হয়েছে।" },
      { status: 500 }
    );
  }
}
