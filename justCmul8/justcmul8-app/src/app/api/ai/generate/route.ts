import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `You are an AI assistant for JustCmul8, a discrete event simulation platform.
Your job is to generate simulation graphs (React Flow compatible JSON) from user descriptions.

Node types available:
- source: Entity generator (has: arrivalRate number, distribution string)
- queue: Waiting buffer (has: capacity number, discipline string: FIFO/LIFO/PRIORITY)
- resource: Service resource (has: capacity number, serviceTime number, serviceDistribution string)
- service: Service step (has: duration number, distribution string)
- decision: Router (has: routes array with {targetId, probability})
- sink: Termination/KPI collector
- priority_resource: Priority-based resource
- container: Level/tank (has: capacity number, level number)
- store: Async store (has: capacity number)
- event_trigger: Event condition node

When the user asks to create or modify a simulation, respond with JSON in this exact format:
{
  "message": "Brief natural language explanation of what was created",
  "graph": {
    "nodes": [
      {
        "id": "node_1",
        "type": "cyberNode",
        "position": { "x": 100, "y": 100 },
        "data": {
          "label": "Customer Source",
          "nodeType": "source",
          "params": { "arrivalRate": 5, "distribution": "exponential" }
        }
      }
    ],
    "edges": [
      {
        "id": "edge_1",
        "source": "node_1",
        "target": "node_2",
        "animated": false
      }
    ]
  }
}

Layout nodes in a top-to-bottom flow. Space nodes at least 150px apart vertically and 200px horizontally.
For simple linear flows: x=200, y increments by 150.
For branching: offset x by ±200 from the decision node.

If the user is asking a question (not creating), respond with ONLY:
{ "message": "Your explanation..." }
`;

export async function POST(req: NextRequest) {
  try {
    const { prompt, simType, currentGraph } = await req.json();
    if (!prompt) return NextResponse.json({ error: "No prompt provided" }, { status: 400 });

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const contextMsg = currentGraph?.nodes?.length
      ? `\nCurrent graph has ${currentGraph.nodes.length} nodes and ${currentGraph.edges.length} edges.`
      : "\nThe canvas is currently empty.";

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\nSimulation type: ${simType}${contextMsg}\n\nUser: ${prompt}` }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 3000,
        responseMimeType: "application/json",
      },
    });

    const text = result.response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Try to extract JSON from response
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else return NextResponse.json({ message: text });
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("AI generate error:", err);
    return NextResponse.json({ error: err.message || "AI generation failed" }, { status: 500 });
  }
}
