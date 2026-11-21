
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const videoId = Number(url.searchParams.get("id"));

    if (![1, 2, 3, 4].includes(videoId)) {
      return new Response("ভিডিও পাওয়া যায়নি", { status: 404 });
    }

    const video = await env.DB.prepare(
      "SELECT id, title, drive_file_id, active FROM videos WHERE id = ?"
    ).bind(videoId).first();

    if (!video || video.active !== 1) {
      return new Response("ভিডিও পাওয়া যায়নি", { status: 404 });
    }

    if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      return new Response("Google Drive সেটআপ পাওয়া যায়নি", { status: 500 });
    }

    return Response.json({
      success: true,
      message: "ভিডিও পাওয়া গেছে।",
      video: {
        id: video.id,
        title: video.title
      }
    });

  } catch (error) {
    return new Response("সার্ভারে সমস্যা হয়েছে", { status: 500 });
  }
}
