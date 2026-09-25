export default async function handler(req, res) {
  // 연결 확인용
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "MY LIFE AI API is running"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not configured"
      });
    }

    const { mode, text, context, imageDataUrl } = req.body || {};

    let instruction = `
너는 MY LIFE 개인 생활관리 앱의 AI 도우미다.
반드시 한국어로 응답한다.

현재 작업 모드: ${mode || "general"}

사용자 요청:
${text || ""}

관련 데이터:
${JSON.stringify(context || {}, null, 2)}

사용자가 확인 후 앱에 적용할 수 있도록
간결하고 구조적인 결과를 만들어라.
`;

    const content = [
      {
        type: "input_text",
        text: instruction
      }
    ];

    if (imageDataUrl) {
      content.push({
        type: "input_image",
        image_url: imageDataUrl
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        input: [
          {
            role: "user",
            content
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);

      return res.status(response.status).json({
        error: "OpenAI API request failed",
        details: data?.error?.message || "Unknown OpenAI error"
      });
    }

    const outputText =
      data.output_text ||
      data.output
        ?.flatMap(item => item.content || [])
        ?.find(item => item.type === "output_text")
        ?.text ||
      "";

    return res.status(200).json({
      ok: true,
      text: outputText
    });

  } catch (error) {
    console.error("MY LIFE API error:", error);

    return res.status(500).json({
      error: "MY LIFE AI server error",
      details: error?.message || String(error)
    });
  }
}
