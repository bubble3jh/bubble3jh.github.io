# bubble3jh.github.io

Source of my homepage: **https://bubble3jh.github.io**

Plain HTML, CSS and a little JavaScript. There is no build step: GitHub Pages serves the files as they are.

## Editing

All content lives in `index.html`.

- **A publication or project:** copy one `<li class="item">` block, give it a new `id`, and set `data-themes` to one
  or two of `robustness`, `llm-vlm`, `generative`, `causality`. The figure in the side column, the counts and the
  theme filter update on their own.
- **Colors and type:** the `:root` block at the top of `assets/css/style.css`.

## Preview

```bash
python3 -m http.server
```

Then open http://localhost:8000.

## Fonts

Instrument Serif, Geist and Geist Mono are self-hosted under the SIL Open Font License (see `assets/fonts/`).
