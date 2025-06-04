/// <reference types="@figma/plugin-typings" />
/// <reference lib="es2019" />
// Make sure you have @figma/plugin-typings installed and referenced in your tsconfig.json
// SceneNode, BaseNode, and ChildrenMixin are provided globally by Figma plugin typings

// code.ts - Compliance-based harmony evaluation\n


function getVisibleNodes(root: SceneNode): SceneNode[] {
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


function evaluateCompliance(referenceNode: SceneNode, libraryNodes: SceneNode[]) {
  const referenceChildren = getVisibleNodes(referenceNode);
  const libraryChildren = libraryNodes.flatMap(getVisibleNodes);

  const colorPass = referenceChildren.every(ref => checkColorMatch(ref, libraryChildren));
  const shapePass = referenceChildren.every(ref => checkShapeMatch(ref, libraryChildren));
  const typographyPass = referenceChildren.every(ref => checkTypographyMatch(ref, libraryChildren));
  const spacingPass = referenceChildren.every(ref => checkSpacingMatch(ref, libraryChildren));
  const effectsPass = referenceChildren.every(ref => checkEffectsMatch(ref, libraryChildren));

  return {
    success: true,
    colorPass,
    shapePass,
    typographyPass,
    spacingPass,
    effectsPass,
  };
}


function generateInsights(results: {
  colorPass: boolean;
  shapePass: boolean;
  typographyPass: boolean;
  spacingPass: boolean;
  effectsPass: boolean;
  usedColors?: string[];
  validColors?: string[];
  usedTypography?: any[];
  validTypography?: any[];
  usedCornerRadii?: number[];
  validCornerRadii?: number[];
  usedSpacing?: number[];
  validSpacing?: number[];
  usedEffects?: any[];
  validEffects?: any[];
}): { icon: string; text: string }[] {
  const insights = [];

  if (!results.colorPass) {
    const failedColors = (results.usedColors || []).filter(c => !(results.validColors || []).includes(c));
    const validList = (results.validColors || []).slice(0, 4).join(", ");
    insights.push({
      icon: "🎨",
      text: failedColors.length
        ? `Color ${failedColors.join(", ")} not found in design library.<br>Valid colors: ${validList}.`
        : "Some colors do not match the design library palette."
    });
  // } else {
  //   insights.push({ icon: "✅", text: "Color usage is compliant with the design system." });
  }

  if (!results.shapePass) {
    const failedRadii = results.usedCornerRadii?.filter(r => !(results.validCornerRadii || []).includes(r)) || [];
    insights.push({
      icon: "📐",
      text: failedRadii.length
        ? `Corner radius ${failedRadii.join(", ")} not found in system. Expected: ${results.validCornerRadii?.join(", ")}.`
        : "Corner radius or shape does not match typical components."
    });
  }

  if (!results.typographyPass) {
    const formatFont = (f: any) => `${f.family} ${f.style} ${f.size}px`;
    const failedFonts = (results.usedTypography || [])
      .filter(f => !(results.validTypography || []).some(v =>
        v.family === f.family && v.style === f.style && v.size === f.size
      ));
    const validFonts = (results.validTypography || []).slice(0, 2).map(formatFont).join(", ");
    insights.push({
      icon: "📝",
      text: failedFonts.length
        ? `Used typography not found: ${failedFonts.map(formatFont).join(", ")}. Valid: ${validFonts}.`
        : "Fonts or text styles differ from the design library."
    });
  }

  if (!results.spacingPass) {
    const failedSpacing = (results.usedSpacing || []).filter(s => !(results.validSpacing || []).includes(s));
    insights.push({
      icon: "↔️",
      text: failedSpacing.length
        ? `Used spacing values: ${failedSpacing.join(", ")}. Expected: ${results.validSpacing?.join(", ")}.`
        : "Spacing between elements is inconsistent with system values."
    });
  // } else {
  //   insights.push({ icon: "✅", text: "Spacing is compliant with the design system." });
  }

  if (!results.effectsPass) {
    const failedEffects = (results.usedEffects || []).filter(e => !(results.validEffects || []).includes(e));
    insights.push({
      icon: "💫",
      text: failedEffects.length
        ? `Used effects: ${failedEffects.join(", ")}. Expected: ${results.validEffects?.join(", ")}.`
        : "Some visual effects (like shadows or blurs) are not compliant with the design system."
    });
  }
  

  return insights;
}




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
          const fontName = text.fontName;
          if (typeof fontName === "object" && "family" in fontName && "style" in fontName) {
            patterns.typographyStyles.add(JSON.stringify({
              family: fontName.family,
              style: fontName.style,
              size: text.fontSize
            }));
          }
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

  // ADD THIS DEBUG:
  if (numericCornerRadii.length > 0) {
    console.log(`Pattern extraction found ${numericCornerRadii.length} corner radius values`);
    console.log(`Radius values: ${numericCornerRadii.join(', ')}`);
    console.log(`Range: ${Math.min(...numericCornerRadii)} to ${Math.max(...numericCornerRadii)}`);
  }
  
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
function calculateHarmony(component: SceneNode, patterns: any, baselineMode: boolean): any {
  const allNodes = collectAllNodes(component);

  if (component.parent) {
    const parent = component.parent as any;
    console.log(`Parent node: ${String(parent.name)}, type: ${String(parent.type)}`);
    console.log(`Parent clipsContent: ${String(parent.clipsContent)}`);
    console.log(`Parent corner radius: ${String(parent.cornerRadius)}`);
  }
  

  if (baselineMode) {
    // 🔍 Visual Baseline Mode — compare to style averages
    // Color match
    const fills = allNodes
      .filter((n): n is SceneNode & { fills: Paint[] } => 'fills' in n)
      .flatMap(n => Array.isArray(n.fills) ? n.fills : [])
      .filter((f): f is SolidPaint => f.type === 'SOLID')
      .map(f => rgbToHex(f.color));
    const colorScore = fills.length
      ? (fills.filter(c => patterns.colorPalette.includes(c)).length / fills.length) * 100
      : 50;

    // 🔁 Corner Radius Match: based on all visible child nodes
// 🔁 Corner Radius Match: Focus on primary visual container only
const visualContainers = allNodes
  .filter(n => {
    if (!('cornerRadius' in n)) return false;
    
    const node = n as any;
    
    // Must have either fills or strokes
    const hasFills = 'fills' in node && Array.isArray(node.fills) && 
                     node.fills.some((f: any) => f.visible !== false);
    const hasStrokes = 'strokes' in node && Array.isArray(node.strokes) && 
                       node.strokes.some((s: any) => s.visible !== false);

    return hasFills || hasStrokes;
    
  })
  .sort((a, b) => {
    // Sort by area to find the largest
    const areaA = ((a as any).width || 0) * ((a as any).height || 0);
    const areaB = ((b as any).width || 0) * ((b as any).height || 0);
    return areaB - areaA;
  });

  

// Use only the corner radius from the largest visual container
let shapeScore = 50; 
// Default if no visual containers found

console.log(`Visual containers found: ${visualContainers.length}`);
console.log(`Pattern corner radius range: ${patterns.cornerRadiusRange.min} to ${patterns.cornerRadiusRange.max}`);
if (visualContainers.length > 0) {
  const primary = visualContainers[0] as any;
  console.log(`Primary container: ${String(primary.name)} (${String(primary.width)}x${String(primary.height)})`);
  console.log(`Corner radius: ${String(primary.cornerRadius)}`);
}

if (visualContainers.length > 0) {
  const primary = visualContainers[0] as any;
  const cornerRadius = primary.cornerRadius;

  console.log(`Primary container: ${String(primary.name)} (${String(primary.width)}x${String(primary.height)})`);
  console.log(`Corner radius: ${String(cornerRadius)}`);

  if (typeof cornerRadius === "number") {
    if (
      cornerRadius >= patterns.cornerRadiusRange.min &&
      cornerRadius <= patterns.cornerRadiusRange.max
    ) {
      shapeScore = 100;
    } else {
      const avgRadius = patterns.cornerRadiusRange.avg;
      const difference = Math.abs(cornerRadius - avgRadius);
      const maxDifference = Math.max(
        patterns.cornerRadiusRange.max - avgRadius,
        avgRadius - patterns.cornerRadiusRange.min
      );
      shapeScore = Math.max(0, 100 - (difference / maxDifference) * 100);
    }
  } else {
    console.warn(`⚠️ Skipping corner radius check: mixed value on ${primary.name}`);
  }
}

    // Typography match
    let typographyScore = 0;
    const text = allNodes.find(n => n.type === 'TEXT') as TextNode;
    if (text && text.fontName && typeof text.fontName === "object" && "family" in text.fontName && "style" in text.fontName) {
      const current = { family: text.fontName.family, style: text.fontName.style, size: Number(text.fontSize) };
      const famMatches = patterns.typographyStyles.filter((s: any) => s.family === current.family);
      if (famMatches.length) {
        typographyScore += 60;
        const styleMatches = famMatches.filter((s: any) => s.style === current.style);
        if (styleMatches.length) {
          typographyScore += 20;
          if (styleMatches.some((s: any) => Math.abs(Number(s.size) - current.size) <= 2)) {
            typographyScore += 20;
          }
        }
      }
    }

    // Spacing match
    const n = component as any;
    let spacingScore = 0;
    if ('paddingLeft' in n) {
      const pads = [n.paddingLeft, n.paddingRight, n.paddingTop, n.paddingBottom];
      spacingScore = (pads.filter(x => x >= patterns.spacingValues.min && x <= patterns.spacingValues.max).length / pads.length) * 100;
    }

    const overallScore = Math.round(colorScore * 0.3 + shapeScore * 0.3 + typographyScore * 0.25 + spacingScore * 0.15);
    return {
      colorScore: Math.round(colorScore),
      shapeScore: Math.round(shapeScore),
      typographyScore: Math.round(typographyScore),
      spacingScore: Math.round(spacingScore),
      overallScore
    };

  } else {
    // 🧠 Component Match Mode — compare to each pattern component, find best match

    const extractPatternsFromSingleNode = (node: SceneNode) => ({
      colorPalette: collectAllNodes(node)
        .flatMap(n => 'fills' in n && Array.isArray((n as any).fills) ? (n as any).fills : [])
        .filter((f: Paint) => f.type === 'SOLID')
        .map((f: SolidPaint) => rgbToHex(f.color)),

        cornerRadiusRange: (() => {
          const radii = allNodes
  .filter((n): n is SceneNode & { cornerRadius: number } =>
    'cornerRadius' in n && typeof (n as any).cornerRadius === 'number'
  )
  .map(n => (n as any).cornerRadius)
  .filter((r): r is number => typeof r === 'number');

const inRange = radii.filter(r => r >= patterns.cornerRadiusRange.min && r <= patterns.cornerRadiusRange.max);

const shapeScore = radii.length ? (inRange.length / radii.length) * 100 : 50;
          return {
            min: Math.min(...radii),
            max: Math.max(...radii),
            avg: radii.reduce((a, b) => a + b, 0) / radii.length || 0
          };
        })(),        

      typographyStyles: collectAllNodes(node)
        .filter(n => n.type === 'TEXT')
        .map(n => {
          const t = n as TextNode;
          return {
            family: (t.fontName as FontName).family,
            style: (t.fontName as FontName).style,
            size: t.fontSize
          };
        }),

      spacingValues: (() => {
        const pads = collectAllNodes(node)
          .filter(n => 'paddingLeft' in n)
          .flatMap(n => {
            const m = n as any;
            return [m.paddingLeft, m.paddingRight, m.paddingTop, m.paddingBottom];
          });
        return {
          min: Math.min(...pads),
          max: Math.max(...pads),
          avg: pads.reduce((a, b) => a + b, 0) / pads.length || 0
        };
      })()
    });

    let bestScore = null;
    for (const node of patterns.components ?? []) {
      const testPattern = extractPatternsFromSingleNode(node);
      const score = calculateHarmony(component, testPattern, true);
       // ← bad
      if (!bestScore || score.overallScore > bestScore.overallScore) {
        bestScore = score;
      }
    }

    return bestScore ?? {
      colorScore: 0,
      shapeScore: 0,
      typographyScore: 0,
      spacingScore: 0,
      overallScore: 0
    };
  }
}

// Global variables to store control and reference nodes
let controlNode: SceneNode | null = null;
let referenceNode: SceneNode | null = null;

// Initialize the plugin
figma.showUI(__html__, { width: 360, height: 480 });

// Handle messages from the UI
figma.ui.onmessage = async (msg: { type: string; nodeId?: string; [key: string]: any }) => {
  if (msg.type === "set-control") {
    if (figma.currentPage.selection.length > 0) {
      controlNode = figma.currentPage.selection[0] as SceneNode;
      await figma.clientStorage.setAsync("controlNodeId", controlNode.id);
      const bytes = await controlNode.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 2 } });
      const base64 = figma.base64Encode(bytes);
      figma.ui.postMessage({ type: "control-set", name: controlNode.name, preview: `data:image/png;base64,${base64}` });
      figma.notify("✅ Design library set: " + controlNode.name);
    } else {
      figma.notify("⚠️ Please select a frame in Figma first");
    }
  }

  if (msg.type === "set-reference") {
    if (figma.currentPage.selection.length > 0) {
      referenceNode = figma.currentPage.selection[0] as SceneNode;
      await figma.clientStorage.setAsync("referenceNodeId", referenceNode.id);
      const bytes = await referenceNode.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 2 } });
      const base64 = figma.base64Encode(bytes);
      figma.ui.postMessage({ type: "reference-set", name: referenceNode.name, preview: `data:image/png;base64,${base64}` });
      figma.notify("✅ Component to check set: " + referenceNode.name);
    } else {
      figma.notify("⚠️ Please select a frame in Figma first");
    }
  }

  if (msg.type === 'run-scan') {
    if (!controlNode || !referenceNode) {
       figma.ui.postMessage({ type: 'scan-result', success: false, message: 'Please set both Design Library and Component first.' });
       return;
    }

    // Use getVisibleNodes to get all visible nodes within the selected nodes
    const controlVisibleNodes = getVisibleNodes(controlNode);
    const referenceVisibleNodes = getVisibleNodes(referenceNode);

    // Extract style and property info
    const extractColors = (nodes: SceneNode[]): string[] => {
      const colors = new Set<string>();
      nodes.forEach(node => {
        if ("fills" in node && Array.isArray(node.fills)) {
          node.fills.forEach(f => {
            if (f.type === 'SOLID' && f.color && f.opacity !== 0) {
              colors.add(rgbToHex(f.color));
            }
          });
        }
      });
      return Array.from(colors);
    };

    const extractCornerRadii = (nodes: SceneNode[]): number[] => {
      const radii = new Set<number>();
       nodes.forEach(node => {
         if ("cornerRadius" in node && typeof node.cornerRadius === 'number') {
           radii.add(node.cornerRadius);
         }
       });
       return Array.from(radii);
    };

    const extractTypography = (nodes: SceneNode[]): { family: string; style: string; size: number }[] => {
      const typographyStyles = new Set<string>();
      nodes.forEach(node => {
        if (node.type === 'TEXT') {
          const textNode = node as TextNode;
          if (textNode.fontName && typeof textNode.fontName === 'object') {
             typographyStyles.add(JSON.stringify({
               family: textNode.fontName.family,
               style: textNode.fontName.style,
               size: textNode.fontSize
             }));
          }
        }
      });
      return Array.from(typographyStyles).map(s => JSON.parse(s));
    };

    const extractSpacing = (nodes: SceneNode[]): number[] => {
      const spacingValues = new Set<number>();
      nodes.forEach(node => {
         if ("itemSpacing" in node && typeof node.itemSpacing === 'number') {
           spacingValues.add(node.itemSpacing);
         }
         // Also consider padding for spacing consistency
          if ("paddingLeft" in node && typeof node.paddingLeft === 'number') spacingValues.add(node.paddingLeft);
          if ("paddingRight" in node && typeof node.paddingRight === 'number') spacingValues.add(node.paddingRight);
          if ("paddingTop" in node && typeof node.paddingTop === 'number') spacingValues.add(node.paddingTop);
          if ("paddingBottom" in node && typeof node.paddingBottom === 'number') spacingValues.add(node.paddingBottom);
      });
      return Array.from(spacingValues);
    };

    const extractEffects = (nodes: SceneNode[]): string[] => {
      const effectTypes = new Set<string>();
       nodes.forEach(node => {
         if ("effects" in node && Array.isArray(node.effects)) {
           node.effects.forEach(e => effectTypes.add(e.type));
         }
       });
       return Array.from(effectTypes);
    };

    const usedColors = extractColors(referenceVisibleNodes);
    const validColors = extractColors(controlVisibleNodes);

    const usedCornerRadii = extractCornerRadii(referenceVisibleNodes);
    const validCornerRadii = extractCornerRadii(controlVisibleNodes);

    const usedTypography = extractTypography(referenceVisibleNodes);
    const validTypography = extractTypography(controlVisibleNodes);

    const usedSpacing = extractSpacing(referenceVisibleNodes);
    const validSpacing = extractSpacing(controlVisibleNodes);

    const usedEffects = extractEffects(referenceVisibleNodes);
    const validEffects = extractEffects(controlVisibleNodes);

    const colorPass = usedColors.every(color => validColors.includes(color));
    const shapePass = usedCornerRadii.every(r => validCornerRadii.includes(r));
    const typographyPass = usedTypography.every(font =>
      validTypography.some(v => v.family === font.family && v.style === font.style && v.size === font.size)
    );
    const spacingPass = usedSpacing.every(spacing => validSpacing.includes(spacing));
    const effectsPass = usedEffects.every(effect => validEffects.includes(effect));

    // Calculate overall pass based on a threshold (e.g., 4 out of 5 categories pass)
    const passedCategories = [colorPass, shapePass, typographyPass, spacingPass, effectsPass].filter(Boolean).length;
    const overallPass = passedCategories >= 4; // Example threshold

    const insights = generateInsights({
      colorPass,
      shapePass,
      typographyPass,
      spacingPass,
      effectsPass,
      usedColors,
      validColors,
      usedCornerRadii,
      validCornerRadii,
      usedTypography,
      validTypography,
      usedSpacing,
      validSpacing,
      usedEffects,
      validEffects
    });

    const passCount = [colorPass, shapePass, typographyPass, spacingPass, effectsPass].filter(p => p).length;

let statusLevel = "Needs fixing ❌";
if (passCount >= 3 && passCount < 5) statusLevel = "Almost there 🔎";
if (passCount === 5) statusLevel = "Looks good! ✅";


figma.ui.postMessage({
  type: 'scan-result',
  success: true,
  overallPass,
  statusLevel,
  results: {
    colorPass,
    shapePass,
    typographyPass,
    spacingPass,
    effectsPass,
    insights
  },
});


    figma.notify("✅ Design harmony analysis complete!");

  }

  if (msg.type === "restore-session") {
    try {
      const controlId = await figma.clientStorage.getAsync("controlNodeId");
      const referenceId = await figma.clientStorage.getAsync("referenceNodeId");
      
      if (controlId) {
        const node = await figma.getNodeByIdAsync(controlId) as SceneNode;
        if (node) {
          controlNode = node;
          figma.ui.postMessage({ type: "control-set", name: node.name });
        }
      }
      
      if (referenceId) {
        const node = await figma.getNodeByIdAsync(referenceId) as SceneNode;
        if (node) {
          referenceNode = node;
          figma.ui.postMessage({ type: "reference-set", name: node.name });
        }
      }
    } catch (error) {
      // Ignore errors during session restore
      console.error("Error restoring session:", error);
    }
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
    referenceNode = null; 
    await figma.clientStorage.setAsync("referenceNodeId", null);
  }
};

function checkColorMatch(ref: SceneNode, libs: SceneNode[]): boolean {
  if ("fills" in ref && Array.isArray(ref.fills)) {
    const refFills = ref.fills as Paint[];
    return refFills.every(refFill => 
      libs.some(lib =>
        "fills" in lib &&
        Array.isArray(lib.fills) &&
        (lib.fills as Paint[]).some(libFill => JSON.stringify(libFill) === JSON.stringify(refFill))
      )
    );
  }
  return true;
}

function checkShapeMatch(ref: SceneNode, libs: SceneNode[]): boolean {
  if ("cornerRadius" in ref && typeof ref.cornerRadius === "number") {
    return libs.some(lib =>
      "cornerRadius" in lib &&
      lib.cornerRadius === ref.cornerRadius
    );
  }
  return true;
}

function checkTypographyMatch(ref: SceneNode, libs: SceneNode[]): boolean {
  if (ref.type === "TEXT") {
    const refFont = ref.fontName as FontName;
    return libs.some(lib =>
      lib.type === "TEXT" &&
      JSON.stringify(lib.fontName) === JSON.stringify(refFont)
    );
  }
  return true;
}

function checkSpacingMatch(ref: SceneNode, libs: SceneNode[]): boolean {
  if ("layoutAlign" in ref && "layoutGrow" in ref) {
    return libs.some(lib =>
      "layoutAlign" in lib &&
      "layoutGrow" in lib &&
      lib.layoutAlign === ref.layoutAlign &&
      lib.layoutGrow === ref.layoutGrow
    );
  }
  return true;
}

function checkEffectsMatch(ref: SceneNode, libs: SceneNode[]): boolean {
  if ("effects" in ref && Array.isArray(ref.effects)) {
    const refEffects = ref.effects as ReadonlyArray<Effect>;
    return refEffects.every(refEffect =>
      libs.some(lib =>
        "effects" in lib &&
        Array.isArray(lib.effects) &&
        (lib.effects as ReadonlyArray<Effect>).some(libEffect => JSON.stringify(libEffect) === JSON.stringify(refEffect))
      )
    );
  }
  return true;
}

/** Gets all control nodes from the current page */
async function getControlNodes(): Promise<SceneNode[]> {
  const controlId = await figma.clientStorage.getAsync("controlNodeId");
  if (!controlId) return [];
  
  const node = await figma.getNodeByIdAsync(controlId) as SceneNode;
  if (!node) return [];
  
  return getVisibleNodes(node);
}