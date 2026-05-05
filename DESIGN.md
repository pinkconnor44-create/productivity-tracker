---
name: Lumina Calendar
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#cbc3d7'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#958ea0'
  outline-variant: '#494454'
  surface-tint: '#d0bcff'
  primary: '#d0bcff'
  on-primary: '#3c0091'
  primary-container: '#a078ff'
  on-primary-container: '#340080'
  inverse-primary: '#6d3bd7'
  secondary: '#adc6ff'
  on-secondary: '#002e6a'
  secondary-container: '#0566d9'
  on-secondary-container: '#e6ecff'
  tertiary: '#dbb8ff'
  on-tertiary: '#3f2160'
  tertiary-container: '#a482c8'
  on-tertiary-container: '#381959'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d0bcff'
  on-primary-fixed: '#23005c'
  on-primary-fixed-variant: '#5516be'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#efdbff'
  tertiary-fixed-dim: '#dbb8ff'
  on-tertiary-fixed: '#29074a'
  on-tertiary-fixed-variant: '#573878'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin: 48px
  container-max: 1280px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The brand personality of this design system is "Effortless Precision." It targets high-performance professionals and creative teams who value both aesthetic beauty and functional speed. The UI should evoke a sense of calm control amidst a busy schedule, using a futuristic, deep-space atmosphere to make time-management feel like a premium experience rather than a chore.

The visual style is a hybrid of **Glassmorphism** and **Minimalism**. It relies on semi-transparent surfaces, vibrant light-leaks, and crisp, high-contrast typography. The interaction model should feel fluid and weightless, utilizing "glow-states" and subtle motion to guide the user's attention through the temporal data.

## Colors

The palette is built on a "Midnight Spectrum." The primary background is a near-black navy to provide maximum contrast for the neon accents. 

*   **Primary:** A vibrant Neon Purple (#8B5CF6) used for main actions and active calendar events.
*   **Secondary:** An Electric Blue (#3B82F6) used for secondary data points and information accents.
*   **Gradients:** Core elements should utilize a linear gradient from Primary to Secondary at a 135-degree angle.
*   **Neutrals:** Surface colors are derived from deep slate tones with varying levels of transparency (Glassmorphism) to create a sense of depth without introducing heavy grays.

## Typography

This design system employs a dual-font strategy to balance technical innovation with readability. 

**Space Grotesk** is used for headlines. Its geometric and slightly eccentric character reinforces the futuristic aesthetic. Headlines should be set with tight tracking to create a "locked-in" professional look.

**Manrope** is used for all body copy and interface labels. Its high legibility and modern proportions ensure that dense calendar data remains easy to parse at a glance. We use a generous line-height for body text to maintain the "airy" feel of the minimalism style.

## Layout & Spacing

The layout follows a **Fixed 12-Column Grid** for the main content area, centered within the viewport. Spacing is governed by a 4px base unit to ensure mathematical harmony across all components.

Vertical rhythm is intentionally spacious. Large sections should be separated by at least `stack-lg` (32px) to allow the background gradients and blurs to "breathe." In data-heavy areas like the calendar view, we condense spacing to `stack-sm` to maximize information density while maintaining clean gutters.

## Elevation & Depth

Hierarchy is established through **Glassmorphism and Tonal Layering**. Instead of traditional shadows, we use:

1.  **Backdrop Blurs:** High-elevation elements (like modals or dropdowns) use a 20px blur with a 60% opaque slate background.
2.  **Inner Glows:** To simulate light hitting the edges of glass, components feature a 1px top-border with 20% white opacity.
3.  **Outer Glows:** Primary buttons and active indicators use a soft, colored "bloom" effect (box-shadow: 0 0 15px [color]) to make them appear as if they are light sources.
4.  **Z-Axis Depth:** Background elements should have a deeper blur than foreground elements to create a naturalistic sense of focus.

## Shapes

The shape language is consistently **Rounded**. We avoid sharp corners to maintain a soft, premium feel. 

Base components like input fields and small buttons use a 0.5rem radius. Large layout cards and container sections use "rounded-xl" (1.5rem) to create a distinct framing effect. This softness contrasts with the technical nature of the typography, making the tool feel more accessible and human-centric.

## Components

### Buttons
Primary buttons are the centerpiece: they feature a vibrant purple-to-blue gradient with white text. On hover, the "outer glow" intensifies. Secondary buttons are "Ghost" style—transparent with a 1px border and a subtle glass blur background.

### Cards & Containers
All cards must use the Glassmorphism style: a semi-transparent dark background, a 1px subtle border, and a significant `backdrop-filter: blur(12px)`. This allows the background neon gradients to peek through without distracting from the content.

### Inputs & Fields
Search and entry fields should be dark, slightly recessed, and feature a neon glow on focus. The placeholder text should be a dimmed slate to keep the UI clean.

### Calendar Events
Event blocks within the calendar should use semi-transparent versions of the primary and secondary colors. If an event is "Now," it receives a pulsing neon dot indicator.

### Chips & Badges
Small, pill-shaped markers used for categories. These should be high-contrast with a slight glow, ensuring they stand out against the glass backgrounds of the cards.