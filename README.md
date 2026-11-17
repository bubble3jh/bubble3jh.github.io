# bubble3jh.github.io

Source of my homepage: **https://bubble3jh.github.io**

Plain HTML, CSS and a little JavaScript. There is no build step: GitHub Pages serves the files as they are.

## Editing

All content lives in `index.html`.

- **A publication:** copy one `<li class="item pub">` block into its year group, give it a new `id`, and set
  - `data-themes`: one or two of `robustness`, `llm-vlm`, `generative`, `causality`
  - `data-year`: the label of its year group (`2026`, `In review`, ...)
  - `data-type`: `preprint`, `journal` or `conference`, and `data-rank`: its position inside that type (1 = newest)
  - `data-first`: present when I am first or co-first author

  The map in the side column, the numbers at the top, the counts and both arrangements (by year, by type) update on
  their own.
- **A project:** copy one `<li class="item card">` block. Ongoing projects go under "Now", finished ones under
  "Past projects" (keep `data-past` on those).
- **The CV:** replace `assets/cv/Jinho_Kang_CV.pdf`. Publish a copy without the phone number and the home address.
- **Colors and type:** the `:root` block at the top of `assets/css/style.css`.

## Preview

```bash
python3 -m http.server
```

Then open http://localhost:8000.

## Fonts

Geist and Geist Mono are self-hosted under the SIL Open Font License (see `assets/fonts/`).
