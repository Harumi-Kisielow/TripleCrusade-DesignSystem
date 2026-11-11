# Triple Crusade — Design System + Press Kit (editável)

## Arquivos (suba TODOS no GitHub, na raiz do repositório)
- index.html, style.css, script.js, admin.js, content.json, robots.txt
- pasta imgs/ (as imagens que você enviar pelo editor são salvas aqui sozinhas)

## Não indexável
`<meta name="robots" content="noindex">` + `robots.txt` com `Disallow: /`.

## Editar (só você)
1. Abra o site, role até o rodapé e clique em "Admin" (ou acrescente ?admin ao endereço).
2. Digite sua senha (ela só abre o token guardado no seu navegador). O token do GitHub é o que realmente impede os outros de editarem.
3. Clique em qualquer coisa para selecionar. Aparecem a barrinha (✥ arrastar · ▲▼ mover · 📷 imagem · ⧉ duplicar · ↰ item pai · 🗑 apagar) e as alças azuis nos cantos e laterais.
   - **Tamanho:** arraste as alças. Em imagens elas mantêm a proporção; Shift estica livremente. Também há largura/altura em % ou px no painel.
   - **Colunas:** botões "2/3/4 colunas". No painel, escolha de 1 a 6 colunas e a largura de cada uma em % (as outras se ajustam), proporções prontas, espaço entre colunas e alinhamento. No celular elas empilham sozinhas.
   - **Posição livre:** liga no painel (Tamanho e posição). Arraste com ✥, use as setas do teclado (Shift = passo maior). Guias rosa ajudam a centralizar e encostar nas bordas (Alt desliga o encaixe). Botões de alinhar (esquerda, centro, direita, topo, meio, base), girar em graus, camada e "para frente/para trás".
   - **Margens e espaço interno** separados por lado; arraste o nome de qualquer campo numérico para ajustar o valor.
   - **Imagens:** cantos por controle deslizante/número (px ou %), botões Reto/Suave/Redondo/Círculo e cada canto separado; moldura (1:1, 4:3, 16:9…), zoom, posição e o botão ✋ para arrastar a imagem dentro da moldura (a roda do mouse dá zoom); "Voltar ao tamanho original". Em "Zoom spotlight ao clicar", habilite a ampliação em tela cheia para cada imagem (os screenshots do Press Kit já vêm habilitados; as demais imagens começam desabilitadas).
   - **Painel:** arraste pelo cabeçalho, encaixe à esquerda/direita (⇄) ou minimize. A posição fica lembrada.
   - **Atalhos:** Ctrl+D duplica · Delete exclui · Esc sai do texto e depois desmarca · Alt+↑/↓ move na ordem.
   - Texto: clique de novo e digite. Ao arrastar, segure Alt para soltar DENTRO de uma caixa.
   - Itens originais apagados ficam escondidos e podem ser restaurados em "Página". Não existe desfazer: "Descartar" volta ao último salvo.
   - **Build:** adicione textos, imagens/GIFs, links, vídeos do YouTube, listas, destaques, divisores, caixas e colunas. Arraste os itens na página ou na árvore de Elementos para reorganizar; use 👁 para ocultar.
   - **Estilos compartilhados:** em Item → Aparência, salve a aparência e o fundo como estilo. Reutilize em outros itens do mesmo tipo; edições de aparência atualizam os itens vinculados.
   - **Mobile:** em Item → Mobile, altere largura, texto, espaçamento e alinhamento em telas pequenas ou oculte o item no celular. A prévia de celular/tablet ajuda a conferir o resultado.
   - **Sites:** configure título, descrição para SEO/compartilhamento, idioma, nome e símbolo do cabeçalho, favicon, imagem de compartilhamento, página inicial, largura, fontes, espaçamento e cabeçalho fixo.
   - **Abas do painel:** Item · Build · Elementos (árvore com todos os itens: clique seleciona, arraste reorganiza, 👁 oculta) · Seções (criar, renomear, duplicar, excluir páginas e escolher a página inicial) · Página (fundo e cores) · Sites (configurações gerais).
   - **Desfazer/refazer:** Ctrl+Z / Ctrl+Shift+Z. Copiar/recortar/colar itens: Ctrl+C / Ctrl+X / Ctrl+V. Salvar: Ctrl+S.
   - **Âncoras:** bloco ⚓ Âncora; links aceitam #nome, section:next, scrollpoint:next, copy:texto, tel:, mailto:, file:nome.pdf e ||blank (nova aba).
4. Clique em Salvar. Tudo vai para o GitHub (imagens em imgs/<página>/ e o layout em content.json). O site atualiza em 1–2 minutos.

## Press Kit
Página `#presskit` montada a partir do PDF. Campos marcados [PREENCHER]: data de lançamento, preço, público-alvo, redes sociais e links de download. Logo do estúdio, fotos da equipe e mídia são caixas de imagem: clique e use 📷.
Na aba **＋ Adicionar**, use **Vídeo / YouTube** para criar um bloco com miniatura automática (cole o link no item “Assistir no YouTube”) ou selecione uma imagem enviada como miniatura. **Animação (GIF)** permite enviar um GIF animado como imagem.

## Arte de botão e fundo por página
- **A imagem é o botão:** selecione um botão/cartão → aba Item → "Imagem de fundo" → Escolher fundo. A imagem estica e vira o botão (continua clicável). Desmarque "A imagem é o botão" para voltar ao texto sobre imagem.
- **Fundo de página:** aba Página → Escolher fundo. Aparece a pergunta "Onde usar este fundo?" (só esta página / todas / escolher páginas). "Aplicar em outras páginas…" repete isso depois; ao remover, também pergunta.

## Fontes, cores, fundo posicionável e estilo vinculado
- **Fontes do jogo:** Cinzel (títulos/números), Libre Bodoni (nomes, textos), Marcellus SC (botões) via Google Fonts. LT Carpet / LT Cushion: colocar `LTCarpet.ttf` e `LTCushion.ttf` em `fonts/`.
- **Caixas de cor:** duplicáveis (Ctrl+D) e criáveis em ＋ Adicionar → Caixa de cor; nome e hex editáveis no painel Item.
- **Imagem de fundo:** Tamanho "Livre" (zoom %), posição ←→ ↑↓, e "✋ Arrastar a imagem de fundo" (arraste + roda do mouse).
- **Vincular itens:** selecione um item e Shift+clique em outros; eles copiam estilo e fundo do selecionado. Clique normal desfaz.
- Página inicial: `#home` (Design System Início). O seletor antigo continua existindo em `#gate`, sem link.
- eai parca