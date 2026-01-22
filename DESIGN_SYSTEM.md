# Design System & Theme Reference

This document serves as a reference for the color palette, typography, and design elements used in the Mc Electronics And Electrics project.

## Color Palette

| Variable    | Hex Code  | Description                           | Usage Examples                         |
| :---        | :---      | :---                                  | :---                                   |
| `$primary1` | `#00bbf0` | **Cyan Blue**                         | Buttons (`.btn1`), Highlights, Hovers  |
| `$primary2` | `#00204a` | **Dark Navy**                         | Section Backgrounds, Headings, Footer  |
| `$white`    | `#ffffff` | **White**                             | Backgrounds, Text on Dark              |
| `$black`    | `#000000` | **Black**                             | Text, Shadows                          |
| `$textCol`  | `#1f1f1f` | **Dark Grey**                         | Body Text                              |
| N/A         | `#f8f8f9` | **Light Grey**                        | Service Box Backgrounds                |

### Gradients
*   **Hero Gradient (Sub-pages):** `linear-gradient(130deg, #231a6f, #0f054c)`
*   **Team Box Gradient:** `linear-gradient(to bottom, #002759, #002b64)`

## Typography

**Font Family:** `Open Sans`, sans-serif  
**Secondary Font:** `Lato` (Available via import)

**Import URL:**
```css
@import url("https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Open+Sans:wght@300;400;600;700&display=swap");
```

## Reusable Mixins (SCSS)

### Hero Button
```scss
@mixin hero_btn($col1, $col2, $pad1, $pad2, $bRadius) {
  display: inline-block;
  padding: $pad1 $pad2;
  background-color: $col1;
  color: $col2;
  border-radius: $bRadius;
  transition: all 0.3s;
  border: none;

  &:hover {
    background-color: darken($color: $col1, $amount: 15);
  }
}
```

### Main Font
```scss
@mixin main-font {
  font-family: "Open Sans", sans-serif;
}
```

## Button Styles

*   **Primary Button (`.btn1`):** Background `$primary1`, Text `$white`.
*   **Secondary Button (`.btn2`):** Background `$black`, Text `$white`.
