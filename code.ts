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


// Helper function to check if a node is visible
function isNodeVisible(node: any): boolean {
  let current: any = node;
  while (current) {
    if ('visible' in current && !current.visible) return false;
    current = current.parent;
  }
  return true;
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