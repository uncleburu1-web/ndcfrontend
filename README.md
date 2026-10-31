# ndcfrontend

React 18 + Vite 5 + TypeScript. Design system per `context/feature-specs/01-design-system.md` (kept in the project context folder).

```bash
npm install
npm run dev            # http://localhost:5173  ·  design system review: /design-system (dev only)
npm run typecheck
npm run check:tokens   # fails if a colour literal exists outside src/styles/tokens.css
npm run build
```

- Tokens: `src/styles/tokens.css` (proposed values, pending owner approval)
- Base styles + font: `src/styles/base.css`
- Components: `src/components/ui/` (import from `src/components/ui`)
- Formatters: `src/lib/format.ts` — `formatNaira`, `formatDate`
