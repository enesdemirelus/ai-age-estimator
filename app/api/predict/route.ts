import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image");

    if (!imageFile || !(imageFile instanceof Blob)) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const payload = new FormData();
    payload.append("image", imageFile);

    const flaskResponse = await fetch("http://127.0.0.1:5000/predict", {
      method: "POST",
      body: payload,
    });

    const data = await flaskResponse.json().catch(() => ({}));

    if (!flaskResponse.ok) {
      console.error("Flask /predict error:", data);
      return NextResponse.json(
        { error: (data as any)?.error || "Flask server error" },
        { status: flaskResponse.status }
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Next.js /api/predict error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
