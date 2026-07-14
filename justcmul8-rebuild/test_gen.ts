import { generateSimPyScript } from './src/lib/simulation/codeGenerator.ts';

const graph = {
  nodes: [
    {
      id: "n1",
      nodeType: "source",
      label: "Arrival Point",
      params: {
        arrivalRate: 1/5,
        distribution: "deterministic",
        routingMode: "round_robin"
      }
    },
    {
      id: "n2",
      nodeType: "queue",
      label: "Waiting Line",
      params: {}
    },
    {
      id: "n3",
      nodeType: "resource",
      label: "Staff / Machine",
      params: {
        capacity: 1,
        serviceTimeMean: 4,
        serviceDistribution: "deterministic"
      }
    },
    {
      id: "n4",
      nodeType: "sink",
      label: "Exit Point",
      params: {}
    }
  ],
  edges: [
    { id: "e1", source: "n1", target: "n2" },
    { id: "e2", source: "n2", target: "n3" },
    { id: "e3", source: "n3", target: "n4" }
  ]
};

const res = generateSimPyScript(graph as any, 15, 15);
import fs from 'fs';
fs.writeFileSync('test_sim.py', res.python);
console.log("Python script generated at test_sim.py");
