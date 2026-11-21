
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const videoId = Number(url.searchParams.get("id"));

    if (![1, 2, 3, 4].includes(videoId)) {
      return Response.json(
        { success: false, message: "ভিডিও পাওয়া যায়নি।" },
        { status: 404 }
      );
    }

    const video = await env.DB.prepare(
      "SELECT id, title, price, active FROM videos WHERE id = ?"
    ).bind(videoId).first();

    if (!video || video.active !== 1) {
      return Response.json(
        { success: false, message: "ভিডিও পাওয়া যায়নি।" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      video: video
    });

  } catch (error) {
    return Response.json(
      { success: false, message: "সার্ভারে সমস্যা হয়েছে।" },
      { status: 500 }
    );
  }
}
