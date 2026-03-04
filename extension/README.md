# Rupt Chrome Extension

Extensão do Chrome para adicionar e iniciar tarefas rapidamente.

## 🚀 Features

- ⚡ Quick add de tarefas com timer automático
- 🔐 Login com Google (Firebase Auth)
- 📊 Sincronização com o app principal
- ⏱️ Timer em tempo real no badge
- 🎨 Interface moderna e responsiva
- ⌨️ Atalho: `Ctrl+Shift+T` (Windows/Linux) ou `Cmd+Shift+T` (Mac)

## 📦 Build

### 1. Configurar Firebase

Copie suas credenciais Firebase para o arquivo `.env` na raiz do projeto (o mesmo usado pelo app principal).

### 2. Build da Extensão

```bash
npm run build:extension
```

Isso criará a pasta `extension-dist` com todos os arquivos da extensão.

### 3. Copiar Arquivos Estáticos

Após o build, copie manualmente:

- `extension/manifest.json` → `extension-dist/`
- `extension/background.js` → `extension-dist/`
- `extension/icons/` → `extension-dist/icons/`

## 📥 Instalar no Chrome

1. Abra `chrome://extensions/`
2. Ative o "Modo do desenvolvedor"
3. Clique em "Carregar sem compactação"
4. Selecione a pasta `extension-dist`

## 🎯 Como Usar

1. Clique no ícone da extensão ou use `Ctrl+Shift+T`
2. Faça login com sua conta Google
3. Digite a descrição da tarefa
4. Clique em "Adicionar e Iniciar" para criar e começar o timer
5. O timer aparecerá no badge do ícone
6. Clique novamente para parar o timer

## 🔗 Links

- App Principal: https://rupt-web.vercel.app
- Suporte: [Criar Issue](https://github.com/seu-repo/issues)

## 🛠️ Desenvolvimento

```bash
# Instalar dependências (use as do projeto principal)
npm install

# Build
npm run build:extension

# O hot reload não funciona para extensões
# Sempre que fizer mudanças, rebuild e reload no chrome://extensions
```
