export default async function handler(req, res) {
  // 연결 확인용
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "MY LIFE AI API is running"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not configured"
      });
    }

    const { task, payload, image } = req.body || {};

    if (!task) {
      return res.status(400).json({
        error: "task is required"
      });
    }

    let instruction = `
너는 개인 생활관리 앱 MY LIFE의 AI 도우미다.

사용자의 요청을 분석하고 반드시 JSON만 반환한다.
마크다운 코드블록은 사용하지 않는다.
설명문을 JSON 앞뒤에 붙이지 않는다.

현재 작업:
${task}

사용자 데이터:
${JSON.stringify(payload || {}, null, 2)}

반드시 앱에서 바로 사용할 수 있는 구조화된 JSON으로 응답한다.

작업이 식단 수정 또는 식단 생성과 관련된 경우 반드시 다음 형식을 사용한다:

{
  "meals": [
    {
      "type": "아침",
      "name": "식단명",
      "kcal": 350,
      "protein": 20,
      "ingredients": [
        {
          "name": "재료명",
          "amount": 100,
          "unit": "g"
        }
      ]
    }
  ],
  "summary": "변경 내용 요약"
}

기존 식단 데이터가 있다면 사용자의 요청에 맞게 수정한다.
칼로리, 단백질, 재료 양은 숫자로 반환한다.
`;

    const content = [
      {
        type: "input_text",
        text: instruction
      }
    ];

    // 이미지가 전달된 경우 AI 이미지 분석에도 사용
    if (image) {
      content.push({
        type: "input_image",
        image_url: image
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-5-mini",
          input: [
            {
              role: "user",
              content
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);

      return res.status(response.status).json({
        error: "OpenAI API request failed",
        details:
          data?.error?.message ||
          "Unknown OpenAI API error"
      });
    }

    const outputText =
      data.output_text ||
      data.output
        ?.flatMap(item => item.content || [])
        ?.find(item => item.type === "output_text")
        ?.text ||
      "";

    if (!outputText) {
      return res.status(500).json({
        error: "AI returned an empty response"
      });
    }

    // AI가 반환한 JSON 문자열을 실제 객체로 변환
    let parsed;

    try {
      let cleanText = outputText.trim();

      // 혹시 AI가 ```json 코드블록을 붙여도 제거
      if (cleanText.startsWith("```")) {
        cleanText = cleanText
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/, "");
      }

      parsed = JSON.parse(cleanText);
    } catch (parseError) {
      console.error("AI JSON parse error:", outputText);

      return res.status(500).json({
        error: "AI response was not valid JSON",
        details: outputText
      });
    }

    // index.html이 data.meals 등으로 바로 사용할 수 있도록 반환
    return res.status(200).json(parsed);

  } catch (error) {
    console.error("MY LIFE API error:", error);

    return res.status(500).json({
      error: "MY LIFE AI server error",
      details:
        error?.message ||
        String(error)
    });
  }
}
