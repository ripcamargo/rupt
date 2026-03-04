# Rupt Chrome Extension Icons

## Como Gerar os Ícones

Os ícones precisam ser criados nos seguintes tamanhos:
- icon16.png (16x16)
- icon32.png (32x32)
- icon48.png (48x48)
- icon128.png (128x128)

### Opção 1: Usando um Conversor Online

1. Use o arquivo `icon.svg` fornecido
2. Acesse: https://www.aconvert.com/image/svg-to-png/
3. Faça upload do icon.svg
4. Converta para PNG em cada tamanho necessário
5. Salve os arquivos nesta pasta com os nomes corretos

### Opção 2: Usando ImageMagick (se instalado)

```bash
# No terminal, na pasta extension/icons/
convert icon.svg -resize 16x16 icon16.png
convert icon.svg -resize 32x32 icon32.png
convert icon.svg -resize 48x48 icon48.png
convert icon.svg -resize 128x128 icon128.png
```

### Opção 3: Usando Inkscape (se instalado)

```bash
inkscape icon.svg --export-png=icon16.png --export-width=16 --export-height=16
inkscape icon.svg --export-png=icon32.png --export-width=32 --export-height=32
inkscape icon.svg --export-png=icon48.png --export-width=48 --export-height=48
inkscape icon.svg --export-png=icon128.png --export-width=128 --export-height=128
```

### Opção 4: Usar Ícones Temporários

Se quiser apenas testar, você pode usar ícones padrão temporariamente:
1. Crie 4 imagens PNG simples nos tamanhos indicados
2. Pode ser apenas um quadrado colorido com a letra "R"
3. A extensão funcionará mesmo com ícones simples

## Design do Ícone

O ícone representa:
- ⚡ Raio: Velocidade e ação rápida (Rupt = Ruptura, rápido)
- 🕐 Relógio: Timer e rastreamento de tempo
- 🎨 Cores: Gradiente #4adeb9 → #3da58a (cores do Rupt)
