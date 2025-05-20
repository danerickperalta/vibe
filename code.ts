/// <reference types="@figma/plugin-typings" />
// Make sure you have @figma/plugin-typings installed and referenced in your tsconfig.json
// SceneNode, BaseNode, and ChildrenMixin are provided globally by Figma plugin typings

// code.ts - Streamlined version

// Simple color utility function - keep this
function rgbToHex(color: {r: number, g: number, b: number}): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

// Simplified component type definitions
const COMPONENT_TYPES = [
  {
    name: "Input Field",
    nodeTypes: ["FRAME", "RECTANGLE", "TEXT"],
    namePatterns: ["input", "field", "text field", "textarea"]
  },
  {
    name: "Button",
    nodeTypes: ["INSTANCE", "FRAME", "RECTANGLE", "TEXT"],
    namePatterns: ["button", "btn", "cta"]
  },
  {
    name: "Icon",
    nodeTypes: ["VECTOR", "FRAME", "INSTANCE"],
    namePatterns: ["icon", "glyph", "symbol"]
  },
  {
    name: "Card",
    nodeTypes: ["FRAME", "COMPONENT", "INSTANCE"],
    namePatterns: ["card", "tile", "container"]
  },
  {
    name: "Typography",
    nodeTypes: ["TEXT"],
    namePatterns: ["text", "heading", "title", "label", "paragraph"]
  }
];

// Simple function to detect component type
function detectComponentType(node: any): string {
  for (const type of COMPONENT_TYPES) {
    if ((type.nodeTypes as string[]).includes(node.type)) {
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
    if ('visible' in current && !current.visible) {
      return false;
    }
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
    if (!componentType || type === componentType) {
      results.push(node);
    }
    
    if ('children' in node) {
      (node as any).children.forEach(traverse);
    }
  }
  
  traverse(rootNode);
  return results;
}

// Extract style patterns from a set of components
async function extractStylePatterns(components: any[]): Promise<any> {
  // Create storage for different pattern types
  const patterns = {
    colors: new Set<string>(),
    cornerRadii: [] as number[],
    typographyStyles: new Set<string>(),
    spacing: [] as number[]
  };
  
  // Analyze each component
  for (const node of components) {
    if ('cornerRadius' in node) {
      const radius = (node as any).cornerRadius;
      if (radius !== undefined) {
        patterns.cornerRadii.push(radius);
      }
    }

    if ('fills' in node) {
      const nodeWithFills = node as any;
      if (Array.isArray(nodeWithFills.fills)) {
        nodeWithFills.fills.forEach((fill: any) => {
          if (fill.type === 'SOLID') {
            patterns.colors.add(rgbToHex(fill.color));
          }
        });
      }
    }

    if (node.type === 'TEXT') {
      const textNode = node as any;
      try {
        await figma.loadFontAsync(textNode.fontName as FontName);
        patterns.typographyStyles.add(JSON.stringify({
          family: textNode.fontName.family,
          style: textNode.fontName.style,
          size: textNode.fontSize
        }));
      } catch (e) {
        // Font may not be accessible
      }
    }

    if ('paddingLeft' in node) {
      const nodeWithPadding = node as any;
      patterns.spacing.push(nodeWithPadding.paddingLeft);
      patterns.spacing.push(nodeWithPadding.paddingRight);
      patterns.spacing.push(nodeWithPadding.paddingTop);
      patterns.spacing.push(nodeWithPadding.paddingBottom);
    }
  }
  
  // Calculate ranges and stats
  return {
    colorPalette: Array.from(patterns.colors),
    cornerRadiusRange: {
      min: Math.min(...patterns.cornerRadii),
      max: Math.max(...patterns.cornerRadii),
      avg: patterns.cornerRadii.reduce((a, b) => a + b, 0) / patterns.cornerRadii.length || 0
    },
    typographyStyles: Array.from(patterns.typographyStyles).map(s => JSON.parse(s)),
    spacingValues: {
      min: Math.min(...patterns.spacing),
      max: Math.max(...patterns.spacing),
      avg: patterns.spacing.reduce((a, b) => a + b, 0) / patterns.spacing.length || 0
    }
  };
}

// Calculate harmony between a component and style patterns
function calculateHarmony(component: any, patterns: any): any {
  let colorScore = 0;
  if ('fills' in component) {
    const nodeWithFills = component as any;
    if (Array.isArray(nodeWithFills.fills) && nodeWithFills.fills.length > 0) {
      let colorMatches = 0;
      let totalColors = 0;
      nodeWithFills.fills.forEach((fill: any) => {
        if (fill.type === 'SOLID') {
          totalColors++;
          const color = rgbToHex(fill.color);
          if (patterns.colorPalette.includes(color)) {
            colorMatches++;
          }
        }
      });
      colorScore = totalColors > 0 ? (colorMatches / totalColors) * 100 : 50;
    }
  }

  let shapeScore = 0;
  if ('cornerRadius' in component) {
    const radius = (component as any).cornerRadius;
    if (radius >= patterns.cornerRadiusRange.min && radius <= patterns.cornerRadiusRange.max) {
      shapeScore = 100;
    } else {
      const distanceToRange = Math.min(
        Math.abs(radius - patterns.cornerRadiusRange.min),
        Math.abs(radius - patterns.cornerRadiusRange.max)
      );
      const maxDistance = Math.max(patterns.cornerRadiusRange.max, 20);
      shapeScore = Math.max(0, 100 - (distanceToRange / maxDistance * 100));
    }
  }

  let typographyScore = 0;
  if (component.type === 'TEXT') {
    const textNode = component as any;
    try {
      if (textNode.fontName) {
        const currentStyle = {
          family: textNode.fontName.family,
          style: textNode.fontName.style,
          size: textNode.fontSize
        };

        const matchingFamilies = patterns.typographyStyles.filter(
          (style: any) => style.family === currentStyle.family
        );

        if (matchingFamilies.length > 0) {
          typographyScore += 60;
          const matchingStyles = matchingFamilies.filter(
            (style: any) => style.style === currentStyle.style
          );
          if (matchingStyles.length > 0) {
            typographyScore += 20;
            const matchingSizes = matchingStyles.filter(
              (style: any) => Math.abs(style.size - currentStyle.size) <= 2
            );
            if (matchingSizes.length > 0) {
              typographyScore += 20;
            }
          }
        }
      }
    } catch (err) {
      // Font access error
    }
  }

  let spacingScore = 0;
  if ('paddingLeft' in component) {
    const nodeWithPadding = component as any;
    const paddings = [
      nodeWithPadding.paddingLeft,
      nodeWithPadding.paddingRight,
      nodeWithPadding.paddingTop,
      nodeWithPadding.paddingBottom
    ];
    let inRangeCount = 0;
    paddings.forEach(padding => {
      if (padding >= patterns.spacingValues.min && padding <= patterns.spacingValues.max) {
        inRangeCount++;
      }
    });
    spacingScore = (inRangeCount / paddings.length) * 100;
  }

  const overallScore = (
    colorScore * 0.3 +
    shapeScore * 0.3 +
    typographyScore * 0.25 +
    spacingScore * 0.15
  );

  return {
    colorScore: Math.round(colorScore),
    shapeScore: Math.round(shapeScore),
    typographyScore: Math.round(typographyScore),
    spacingScore: Math.round(spacingScore),
    overallScore: Math.round(overallScore)
  };
}

// Global variables to store control and reference nodes
let controlNode: any = null;
let referenceNode: any = null;

// Initialize the plugin
figma.showUI(__html__, { width: 360, height: 480 });

// Handle messages from the UI
figma.ui.onmessage = async (msg: { type: string; [key: string]: any }) => {
  if (msg.type === "set-control") {
    if (figma.currentPage.selection.length > 0) {
      controlNode = figma.currentPage.selection[0];
      await figma.clientStorage.setAsync("controlNodeId", controlNode.id);
      const bytes = await controlNode.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 2 } });
const base64 = figma.base64Encode(bytes);

figma.ui.postMessage({
  type: "control-set",
  name: controlNode.name,
  preview: `data:image/png;base64,${base64}`
});

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

figma.ui.postMessage({
  type: "reference-set",
  name: referenceNode.name,
  preview: `data:image/png;base64,${base64}`
});

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
    const controlComponents = getComponentsOfType(controlNode, referenceType);
    if (controlComponents.length === 0) {
      figma.ui.postMessage({
        type: "scan-result",
        success: false,
        message: `No ${referenceType} components found in the design library.`
      });
      return;
    }
    const stylePatterns = await extractStylePatterns(controlComponents);
    const harmonyScore = calculateHarmony(referenceNode, stylePatterns);
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
        const node = await figma.getNodeByIdAsync(controlId);
        if (node) {
          controlNode = node;
          figma.ui.postMessage({
            type: "control-set",
            name: node.name
          });
        }
      }
      if (referenceId) {
        const node = await figma.getNodeByIdAsync(referenceId);
        if (node) {
          referenceNode = node;
          figma.ui.postMessage({
            type: "reference-set",
            name: node.name
          });
        }
      }
    } catch (error) {
      // Error restoring session
    }
  }
  if (msg.type === "focus-node") {
    console.log("🔍 Focus requested:", msg.nodeId);
    let node: SceneNode | null = null;

if (msg.nodeId === "control") {
  node = controlNode;
} else if (msg.nodeId === "reference") {
  node = referenceNode;
}

if (!node) {
  const nodeIdKey = msg.nodeId === "control" ? "controlNodeId" : "referenceNodeId";
  const storedId = await figma.clientStorage.getAsync(nodeIdKey);
  if (storedId) {
    node = figma.getNodeById(storedId) as SceneNode;
  }
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
    controlNode = null;
    referenceNode = null;
  
    await figma.clientStorage.setAsync("controlNodeId", null);
    await figma.clientStorage.setAsync("referenceNodeId", null);
  
    figma.ui.postMessage({ type: "reset-complete" });
  }
  
  if (msg.type === 'clear-control') {
    controlNode = null;
    await figma.clientStorage.setAsync("controlNodeId", null);
    // no need to post back—UI already cleared itself
  }
  
  if (msg.type === 'clear-reference') {
    referenceNode = null;
    await figma.clientStorage.setAsync("referenceNodeId", null);
  }
  
   
};