# Design System — template editável

Estrutura inspirada em guias de design system de jogos: home com 5 cartões e 5 seções (Fundamentos, Identidade, Ilustração, Componentes, Interações).

## Arquivos
- `index.html` — conteúdo. Procure por `[EDITE]` para os textos de exemplo.
- `style.css` — bloco `:root` no topo guarda cores, fonte e raio. Mudou lá, mudou no site todo (inclusive os cartões de cor).
- `script.js` — navegação, copiar HEX, carimbo e cursor/arrastar.
- `robots.txt` — bloqueia buscadores.

## Não indexável
Duas camadas: `<meta name="robots" content="noindex...">` no `index.html` e `robots.txt` com `Disallow: /`.
Isso só tira o site das buscas. Quem tiver o link consegue abrir. Para exigir senha, use Netlify (Password Protection) ou Cloudflare Access.

## Publicar (grátis)
**GitHub Pages:** crie um repositório, envie os 5 arquivos, vá em Settings → Pages → Branch `main` / root.
**Netlify:** arraste a pasta em app.netlify.com/drop.
Para editar depois, altere os arquivos no repositório (ou direto pelo editor web do GitHub, tecla `.`).

## Imagens
Crie uma pasta `imgs/` e troque os blocos `.img-slot` por `<img src="imgs/arquivo.png" alt="...">`.

## Painel Admin
Clique em "Admin" no rodapé do site. Na 1ª vez, informe o repositório, o token do GitHub e crie uma senha.
Depois é só a senha. Edite textos clicando neles, troque imagens nas caixas tracejadas e clique em "Salvar no GitHub".
Tudo é gravado em `content.json` e em `imgs/`.
