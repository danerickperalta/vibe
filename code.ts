/// <reference types="@figma/plugin-typings" />
/// <reference lib="es2019" />
// Make sure you have @figma/plugin-typings installed and referenced in your tsconfig.json
// SceneNode, BaseNode, and ChildrenMixin are provided globally by Figma plugin typings

// code.ts - Enhanced version with recursive harmony analysis

// Simple color utility function - keep this
function rgbToHex(color: {r: number, g: number, b: number}): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

// Simplified component type definitions
const COMPONENT_TYPES = [
  { name: "Input Field", nodeTypes: ["FRAME", "RECTANGLE", "TEXT"], namePatterns: ["input", "field", "text field", "textarea"] },
  { name: "Button", nodeTypes: ["INSTANCE", "FRAME", "RECTANGLE", "TEXT"], namePatterns: ["button", "btn", "cta"] },
  { name: "Icon", nodeTypes: ["VECTOR", "FRAME", "INSTANCE"], namePatterns: ["icon", "glyph", "symbol"] },
  { name: "Card", nodeTypes: ["FRAME", "COMPONENT", "INSTANCE"], namePatterns: ["card", "tile", "container"] },
  { name: "Typography", nodeTypes: ["TEXT"], namePatterns: ["text", "heading", "title", "label", "paragraph"] }
];

/** Returns this node plus all of its visible descendants */
function collectAllNodes(root: SceneNode): SceneNode[] {
  const all: SceneNode[] = [];
  function recurse(node: SceneNode) {
    if (!isNodeVisible(node)) return;
    all.push(node);
    if ('children' in node) {
      (node as ChildrenMixin & SceneNode).children.forEach(recurse);
    }
  }
  recurse(root);
  return all;
}

// Simple function to detect component type
function detectComponentType(node: any): string {
  for (const type of COMPONENT_TYPES) {
    if (type.nodeTypes.includes(node.type)) {
      const nodeName = node.name.toLowerCase();
      for (const pattern of type.namePatterns) {
        if (nodeName.includes(pattern.toLowerCase())) {
          return type.name;
        }
      }
    }
  }
  return "Unknown";
}

// Helper function to check if a node is visible
function isNodeVisible(node: any): boolean {
  let current: any = node;
  while (current) {
    if ('visible' in current && !current.visible) return false;
    current = current.parent;
  }
  return true;
}

// Get all visible nodes of a certain component type
function getComponentsOfType(rootNode: any, componentType: string | null = null): any[] {
  const results: any[] = [];
  function traverse(node: any) {
    if (!isNodeVisible(node)) return;
    const type = detectComponentType(node);
    if (!componentType || type === componentType) results.push(node);
    if ('children' in node) {
      (node as any).children.forEach(traverse);
    }
  }
  traverse(rootNode);
  return results;
}

// Extract style patterns from a set of components (recursive)
async function extractStylePatterns(components: any[]): Promise<any> {
  const patterns = {
    colors: new Set<string>(),
    cornerRadii: [] as number[],
    typographyStyles: new Set<string>(),
    spacing: [] as number[]
  };

  for (const rootNode of components) {
    const subtree = collectAllNodes(rootNode);
    for (const node of subtree) {
      // Corner radii
      if ('cornerRadius' in node) {
        patterns.cornerRadii.push((node as any).cornerRadius);
      }
      // Solid fills
      if ('fills' in node) {
        const fills = (node as any).fills as Paint[];
        if (Array.isArray(fills)) {
          for (const f of fills) {
            if (f.type === 'SOLID') {
              patterns.colors.add(rgbToHex(f.color));
            }
          }
        }
      }
      // Typography
      if (node.type === 'TEXT') {
        const text = node as TextNode;
        try {
          await figma.loadFontAsync(text.fontName as FontName);
          const fontName = text.fontName as FontName;
          patterns.typographyStyles.add(JSON.stringify({
            family: fontName.family,
            style: fontName.style,
            size: text.fontSize
          }));
        } catch { /* ignore missing fonts */ }
      }
      // Spacing
      if ('paddingLeft' in node) {
        const n = node as any;
        patterns.spacing.push(n.paddingLeft, n.paddingRight, n.paddingTop, n.paddingBottom);
      }
    }
  }

  
  // Filter out non-number corner radii
  const numericCornerRadii = patterns.cornerRadii.filter((r): r is number => typeof r === 'number');

  return {
    colorPalette: Array.from(patterns.colors),
    cornerRadiusRange: {
      min: Math.min(...numericCornerRadii),
      max: Math.max(...numericCornerRadii),
      avg: numericCornerRadii.reduce((a, b) => a + b, 0) / numericCornerRadii.length || 0
    },
    typographyStyles: Array.from(patterns.typographyStyles).map(s => JSON.parse(s)),
    spacingValues: {
      min: Math.min(...patterns.spacing),
      max: Math.max(...patterns.spacing),
      avg: patterns.spacing.reduce((a, b) => a + b, 0) / patterns.spacing.length || 0
    }
  };

}

// Calculate harmony between a component and style patterns (recursive)
function calculateHarmony(component: SceneNode, patterns: any): any {
  // Color
  const fills = collectAllNodes(component)
    .filter((n): n is SceneNode & { fills: Paint[] } => 'fills' in n)
    .flatMap(n => Array.isArray(n.fills) ? n.fills : [])
    .filter((f): f is SolidPaint => f.type === 'SOLID')
    .map(f => rgbToHex(f.color));
  let colorScore = fills.length
    ? (fills.filter((c: string) => patterns.colorPalette.includes(c)).length / fills.length) * 100
    : 50;

// Shape Score: compare all corner radii across the component
const allNodes = collectAllNodes(component);
const componentRadii = allNodes
  .filter((n): n is SceneNode & { cornerRadius: number } => 'cornerRadius' in n && typeof (n as any).cornerRadius === 'number')
  .map(n => (n as any).cornerRadius as number);

let shapeScore = 0;
if (componentRadii.length > 0) {
  const { min, max } = patterns.cornerRadiusRange;
  const inRange = componentRadii.filter(r => r >= min && r <= max);
  shapeScore = (inRange.length / componentRadii.length) * 100;
}

  // Typography
  let typographyScore = 0;
  const textNodes = collectAllNodes(component).filter(n => n.type === 'TEXT') as TextNode[];
  if (textNodes.length) {
    const tn = textNodes[0];
    const fontName = tn.fontName as FontName;
    const current = { family: fontName.family, style: fontName.style, size: Number(tn.fontSize) };
    const famMatches = patterns.typographyStyles.filter((s: { family: string; style: string; size: number }) => s.family === current.family);
    if (famMatches.length) {
      typographyScore += 60;
      const styleMatches = famMatches.filter((s: { family: string; style: string; size: number }) => s.style === current.style);
      if (styleMatches.length) {
        typographyScore += 20;
        if (styleMatches.some((s: { family: string; style: string; size: number }) => Math.abs(Number(s.size) - current.size) <= 2)) {
          typographyScore += 20;
        }
      }
    }
  }

  // Spacing
  let spacingScore = 0;
  const n = component as any;
  if ('paddingLeft' in n) {
    const pads = [n.paddingLeft, n.paddingRight, n.paddingTop, n.paddingBottom] as number[];
    spacingScore = (pads.filter(x => x >= patterns.spacingValues.min && x <= patterns.spacingValues.max).length / pads.length) * 100;
  }

  const overallScore = Math.round(colorScore * 0.3 + shapeScore * 0.3 + typographyScore * 0.25 + spacingScore * 0.15);
  return {
    colorScore:     Math.round(colorScore),
    shapeScore:     Math.round(shapeScore),
    typographyScore: Math.round(typographyScore),
    spacingScore:   Math.round(spacingScore),
    overallScore
  };
}

// Global variables to store control and reference nodes
let controlNode: SceneNode | null = null;
let referenceNode: SceneNode | null = null;

// Initialize the plugin
figma.showUI(__html__, { width: 360, height: 480 });

// Handle messages from the UI
figma.ui.onmessage = async (msg: { type: string; [key: string]: any }) => {
  let useReferenceAsBaseline = false;
  if (msg.type === "toggle-baseline") {
    useReferenceAsBaseline = msg.value;
  }  
  if (msg.type === "set-control") {
    if (figma.currentPage.selection.length > 0) {
      controlNode = figma.currentPage.selection[0];
      await figma.clientStorage.setAsync("controlNodeId", controlNode.id);
      const bytes = await controlNode.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 2 } });
      const base64 = figma.base64Encode(bytes);
      figma.ui.postMessage({ type: "control-set", name: controlNode.name, preview: `data:image/png;base64,${base64}` });
      figma.notify("✅ Design library set: " + controlNode.name);
    } else {
      figma.notify("⚠️ Please select a node first");
    }
  }
  if (msg.type === "set-reference") {
    if (figma.currentPage.selection.length > 0) {
      referenceNode = figma.currentPage.selection[0];
      await figma.clientStorage.setAsync("referenceNodeId", referenceNode.id);
      const bytes = await referenceNode.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 2 } });
      const base64 = figma.base64Encode(bytes);
      figma.ui.postMessage({ type: "reference-set", name: referenceNode.name, preview: `data:image/png;base64,${base64}` });
      figma.notify("✅ Component to check set: " + referenceNode.name);
    } else {
      figma.notify("⚠️ Please select a node first");
    }
  }
  if (msg.type === "run-scan") {
    if (!controlNode || !referenceNode) {
      figma.notify("⚠️ Please set both a design library and a component to check");
      return;
    }
  
    const referenceType = detectComponentType(referenceNode);
  
    // 🔁 Use baseline toggle to determine direction
    const patternSource = useReferenceAsBaseline ? referenceNode : controlNode;
    const testTarget = useReferenceAsBaseline ? controlNode : referenceNode;
  
    const patternComponents = useReferenceAsBaseline
      ? getComponentsOfType(patternSource) // Analyze all variants in baseline frame
      : getComponentsOfType(patternSource, referenceType); // Only grab like components from system
  
    if (patternComponents.length === 0) {
      figma.ui.postMessage({
        type: "scan-result",
        success: false,
        message: `No ${referenceType} components found in the selected baseline.`
      });
      return;
    }
  
    const stylePatterns = await extractStylePatterns(patternComponents);
    const harmonyScore = calculateHarmony(testTarget, stylePatterns);
  
    figma.ui.postMessage({
      type: "scan-result",
      success: true,
      componentType: referenceType,
      patterns: stylePatterns,
      harmony: harmonyScore
    });
  
    figma.notify("✅ Design harmony analysis complete!");
  }
  
  if (msg.type === "restore-session") {
    try {
      const controlId = await figma.clientStorage.getAsync("controlNodeId");
      const referenceId = await figma.clientStorage.getAsync("referenceNodeId");
      if (controlId) {
        const node = await figma.getNodeByIdAsync(controlId) as SceneNode;
        if (node) { controlNode = node; figma.ui.postMessage({ type: "control-set", name: node.name }); }
      }
      if (referenceId) {
        const node = await figma.getNodeByIdAsync(referenceId) as SceneNode;
        if (node) { referenceNode = node; figma.ui.postMessage({ type: "reference-set", name: node.name }); }
      }
    } catch {/* ignore */ }
  }
  if (msg.type === "focus-node") {
    let node: SceneNode | null = msg.nodeId === "control" ? controlNode : referenceNode;
    if (!node) {
      const key = msg.nodeId === "control" ? "controlNodeId" : "referenceNodeId";
      const id = await figma.clientStorage.getAsync(key);
      if (id) node = figma.getNodeById(id) as SceneNode;
    }
    if (node) {
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
      figma.notify("🔍 Focused on " + node.name);
    } else {
      figma.notify("⚠️ Couldn't find the node to focus on.");
    }
  }
  if (msg.type === "reset") {
    controlNode = null; referenceNode = null;
    await figma.clientStorage.setAsync("controlNodeId", null);
    await figma.clientStorage.setAsync("referenceNodeId", null);
    figma.ui.postMessage({ type: "reset-complete" });
  }
  if (msg.type === "clear-control") {
    controlNode = null; await figma.clientStorage.setAsync("controlNodeId", null);
  }
  if (msg.type === "clear-reference") {
    referenceNode = null; await figma.clientStorage.setAsync("referenceNodeId", null);
  }
};