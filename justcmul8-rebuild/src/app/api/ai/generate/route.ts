import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { SimTypeId } from "@/lib/simulation/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const BASE_SYSTEM_PROMPT = `You are a system architecture AI. Your job is to convert the user's plain English description of a process into a valid JustCmul8 JSON graph.

The graph MUST conform to this exact JSON schema:
{
  "nodes": [
    {
      "id": "unique_string_id",
      "nodeType": "<one of the 15 types below>",
      "label": "Human readable name",
      "position": { "x": number, "y": number },
      "params": { ... }
    }
  ],
  "edges": [
    {
      "id": "unique_edge_id",
      "source": "source_node_id",
      "target": "target_node_id"
    }
  ]
}

The 15 valid nodeTypes and their required params are:
1. source: { arrivalRate: number, distribution: "exponential"|"uniform"|"deterministic" }
2. queue: { capacity: number (-1 for infinite), discipline: "FIFO" }
3. resource: { capacity: number, serviceTimeMean: number, serviceDistribution: string }
4. priority_resource: { capacity: number, isPreemptive: boolean }
5. service: { durationMean: number, distribution: string }
6. decision: { routes: [{ targetId: string, probability: number }] }
7. sink: {}
8. container: { capacity: number, initialLevel: number }
9. store: { capacity: number }
10. event_trigger: { eventName: string }
11. any_of: { targetId: string }
12. all_of: { targetId: string }
13. channel: { bufferCapacity: number, propagationDelay: number, delayDistribution: string }
14. broadcaster: {}
15. interrupter: { targetNodeId: string, cause: string }

Rules:
1. Position x/y should lay out the graph logically (left to right, ~200px apart).
2. ONLY output valid JSON.
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, simType, currentNodesCount } = body;

    const domainPrompt = SIM_TYPE_REGISTRY[simType as SimTypeId]?.aiSystemPrompt || "";
    
    const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}\n\nDOMAIN CONTEXT:\n${domainPrompt}`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
      systemInstruction: fullSystemPrompt,
    });

    const contextualPrompt = `The current graph has ${currentNodesCount} nodes. User request: ${prompt}`;

    const result = await model.generateContent(contextualPrompt);
    const response = await result.response;
    const text = response.text();
    
    return NextResponse.json(JSON.parse(text));
  } catch (error: any) {
    console.error("AI Generate Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
