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


function getValidLibraryNodes(): SceneNode[] {
  return figma.currentPage.selection.filter((node) =>
    ['COMPONENT', 'FRAME', 'INSTANCE'].includes(node.type)
  );
}


// Simple function to detect component type
function detectComponentType(node: SceneNode): string {
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
function isNodeVisible(node: SceneNode): boolean {
  let current: BaseNode | null = node;
  while (current) {
    if ('visible' in current && !current.visible) {
      return false;
    }
    current = current.parent;
  }
  return true;
}

// Get all visible nodes of a certain component type
function getComponentsOfType(rootNode: SceneNode, componentType: string | null = null): SceneNode[] {
  const results: SceneNode[] = [];
  
  function traverse(node: SceneNode) {
    if (!isNodeVisible(node)) return;
    
    const type = detectComponentType(node);
    if (!componentType || type === componentType) {
      results.push(node);
    }
    
    if ('children' in node) {
      (node as ChildrenMixin & SceneNode).children.forEach(traverse);
    }
  }
  
  traverse(rootNode);
  return results;
}

// Extract style patterns from a set of components
function extractStylePatterns(components: SceneNode[]): any {
  // Create storage for different pattern types
  const patterns = {
    colors: new Set<string>(),
    cornerRadii: [] as number[],
    typographyStyles: new Set<string>(),
    spacing: [] as number[]
  };
  
  // Analyze each component
  components.forEach(node => {
    // Extract colors
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
    
    // Extract corner radius
    if ('cornerRadius' in node) {
      patterns.cornerRadii.push((node as any).cornerRadius);
    }
    
    // Extract typography details
    if (node.type === 'TEXT') {
      const textNode = node as TextNode;
      if (textNode.fontName) {
        patterns.typographyStyles.add(JSON.stringify({
          family: textNode.fontName.family,
          style: textNode.fontName.style,
          size: textNode.fontSize
        }));
      }
    }
    
    // Extract spacing
    if ('paddingLeft' in node) {
      const nodeWithPadding = node as any;
      patterns.spacing.push(nodeWithPadding.paddingLeft);
      patterns.spacing.push(nodeWithPadding.paddingRight);
      patterns.spacing.push(nodeWithPadding.paddingTop);
      patterns.spacing.push(nodeWithPadding.paddingBottom);
    }
  });
  
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
function calculateHarmony(component: SceneNode, patterns: any): any {
  // Score for color harmony
  let colorScore = 0;
  if ('fills' in component) {
    const nodeWithFills = component as any;
    if (Array.isArray(nodeWithFills.fills) && nodeWithFills.fills.length > 0) {
      // Check each fill against the color palette
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
  
  // Score for shape harmony
  let shapeScore = 0;
  if ('cornerRadius' in component) {
    const radius = (component as any).cornerRadius;
    // If radius is within the range, it's a good match
    if (radius >= patterns.cornerRadiusRange.min && radius <= patterns.cornerRadiusRange.max) {
      shapeScore = 100;
    } else {
      // Otherwise score based on how close it is to the range
      const distanceToRange = Math.min(
        Math.abs(radius - patterns.cornerRadiusRange.min),
        Math.abs(radius - patterns.cornerRadiusRange.max)
      );
      const maxDistance = Math.max(patterns.cornerRadiusRange.max, 20); // Avoid division by zero
      shapeScore = Math.max(0, 100 - (distanceToRange / maxDistance * 100));
    }
  }
  
  // Score for typography harmony
  let typographyScore = 0;
  if (component.type === 'TEXT') {
    const textNode = component as TextNode;
    if (textNode.fontName) {
      // Check if this exact font style is used in the patterns
      const currentStyle = {
        family: textNode.fontName.family,
        style: textNode.fontName.style,
        size: textNode.fontSize
      };
      
      // Look for matching font family
      const matchingFamilies = patterns.typographyStyles.filter(
        (style: any) => style.family === currentStyle.family
      );
      
      if (matchingFamilies.length > 0) {
        typographyScore += 60; // 60% score for matching family
        
        // Check for matching style
        const matchingStyles = matchingFamilies.filter(
          (style: any) => style.style === currentStyle.style
        );
        
        if (matchingStyles.length > 0) {
          typographyScore += 20; // Additional 20% for matching style
          
          // Check for matching size or close to it
          const matchingSizes = matchingStyles.filter(
            (style: any) => Math.abs(style.size - currentStyle.size) <= 2
          );
          
          if (matchingSizes.length > 0) {
            typographyScore += 20; // Final 20% for matching size
          }
        }
      }
    }
  }
  
  // Score for spacing harmony
  let spacingScore = 0;
  if ('paddingLeft' in component) {
    const nodeWithPadding = component as any;
    const paddings = [
      nodeWithPadding.paddingLeft,
      nodeWithPadding.paddingRight, 
      nodeWithPadding.paddingTop,
      nodeWithPadding.paddingBottom
    ];
    
    // Check if paddings are within the spacing range
    let inRangeCount = 0;
    paddings.forEach(padding => {
      if (padding >= patterns.spacingValues.min && padding <= patterns.spacingValues.max) {
        inRangeCount++;
      }
    });
    
    spacingScore = (inRangeCount / paddings.length) * 100;
  }
  
  // Calculate overall harmony score
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
let controlNode: SceneNode | null = null;
let referenceNode: SceneNode | null = null;

// Initialize the plugin
figma.showUI(__html__, { width: 360, height: 480 });

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === "set-control") {
    if (getValidLibraryNodes().length > 0) {
      controlNode = getValidLibraryNodes()[0];
      
      // Store control node ID for persistence
      await figma.clientStorage.setAsync("controlNodeId", controlNode.id);
      
      figma.ui.postMessage({
        type: "control-set",
        name: controlNode.name
      });
      
      figma.notify("✅ Design library set: " + controlNode.name);
    } else {
      figma.notify("⚠️ Please select a node first");
    }
  }
  
  if (msg.type === "set-reference") {
    if (getValidLibraryNodes().length > 0) {
      referenceNode = getValidLibraryNodes()[0];
      
      // Store reference node ID for persistence
      await figma.clientStorage.setAsync("referenceNodeId", referenceNode.id);
      
      figma.ui.postMessage({
        type: "reference-set",
        name: referenceNode.name
      });
      
      figma.notify("✅ Component to check set: " + referenceNode.name);
    } else {
      figma.notify("⚠️ Please select a node first");
    }
  }
  
  if (msg.type === "run-scan") {
    // Validate that both control and reference are set
    if (!controlNode || !referenceNode) {
      figma.notify("⚠️ Please set both a design library and a component to check");
      return;
    }
    
    // Get the component type of the reference
    const referenceType = detectComponentType(referenceNode);
    
    // Extract all components of the same type from the control
    const controlComponents = getComponentsOfType(controlNode, referenceType);
    
    // If no matching components found, notify the user
    if (controlComponents.length === 0) {
      figma.ui.postMessage({
        type: "scan-result",
        success: false,
        message: `No ${referenceType} components found in the design library.`
      });
      return;
    }
    
    // Extract style patterns from control components
    const stylePatterns = extractStylePatterns(controlComponents);
    
    // Calculate harmony between reference and patterns
    const harmonyScore = calculateHarmony(referenceNode, stylePatterns);
    
    // Send results back to the UI
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
    // Try to restore previously selected nodes
    try {
      const controlId = await figma.clientStorage.getAsync("controlNodeId");
      const referenceId = await figma.clientStorage.getAsync("referenceNodeId");
      
      if (controlId) {
        controlNode = await figma.getNodeByIdAsync(controlId) as SceneNode;
        if (controlNode) {
          figma.ui.postMessage({
            type: "control-set",
            name: controlNode.name
          });
        }
      }
      
      if (referenceId) {
        referenceNode = await figma.getNodeByIdAsync(referenceId) as SceneNode;
        if (referenceNode) {
          figma.ui.postMessage({
            type: "reference-set",
            name: referenceNode.name
          });
        }
      }
    } catch (error) {
      console.error("Error restoring session:", error);
    }
  }
  
  if (msg.type === "focus-node") {
    try {
      const node = msg.nodeId === "control" 
        ? controlNode 
        : (msg.nodeId === "reference" ? referenceNode : null);
        
      if (node) {
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
      }
    } catch (error) {
      console.error("Error focusing node:", error);
    }
  }
  
  if (msg.type === "close-plugin") {
    figma.closePlugin();
  }
};