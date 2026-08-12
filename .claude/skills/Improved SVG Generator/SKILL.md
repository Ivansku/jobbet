# Skill: Advanced SVG Image Generator

## Purpose
Enables the generation of clean, responsive, semantic, and highly scalable SVG illustrations, technical diagrams, or icons directly from text descriptions.

## Generation Rules
* Always use a clear `viewBox` (e.g., `viewBox="0 0 800 600"`). Avoid hardcoded `width` and `height` attributes unless necessary for absolute aspect constraints.
* Structure components semantically using `<g>` tags with descriptive `id` or `class` attributes.
* Prioritize reusable elements by defining gradients, masks, and repeated symbols inside a `<defs>` block at the beginning of the file.
* Use explicit, precise coordinate definitions for path nodes rather than approximate spatial guesswork.
* When adding style, use CSS strings inside a `<style>` block or native presentation attributes over inline styles.

## Iterative Execution Loop
1. **Analyze Constraints**: Break down the user's graphic description into layered shapes, background elements, and foreground accents.
2. **Draft Core Elements**: Code the basic structure using primitive shapes (`<circle>`, `<rect>`, `<path>`).
3. **Enhance Depth**: Inject gradients, drop shadows (`feDropShadow`), or masks to achieve realism/stylization.
4. **Optimize Code**: Strip redundant groups, run the code through SVGO optimization patterns, and add accessibility (`<title>`, `<desc>`).
5. **Render Preview**: If an external `render-svg` or `potrace` tool is linked via MCP, execute it to visually verify the layout before concluding.
