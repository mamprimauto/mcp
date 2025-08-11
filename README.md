# Global MCP Manager

Um servidor MCP (Model Context Protocol) que permite executar comandos de terminal em diferentes contextos: local, SSH e GitHub.

<a href="https://glama.ai/mcp/servers/@mamprimauto/mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@mamprimauto/mcp/badge" alt="Global Manager MCP server" />
</a>

## Características

- **Contexto Local**: Execute comandos no sistema local
- **Contexto SSH**: Execute comandos em servidores remotos via SSH
- **Contexto GitHub**: Integração com repositórios GitHub (em desenvolvimento)
- **Gerenciamento de arquivos**: Leia, escreva, renomeie e remova arquivos
- **Navegação de diretórios**: Liste, crie e navegue por diretórios

## Instalação

```bash
npm install
```

## Configuração no Claude Desktop

Adicione ao seu arquivo `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "global-mcp": {
      "command": "/opt/homebrew/bin/node",
      "args": [
        "/caminho/para/seu/global-mcp/index.js"
      ],
      "cwd": "/caminho/para/seu/global-mcp"
    }
  }
}
```

## Uso

O MCP Manager oferece as seguintes ferramentas:

### Ferramentas de Terminal
- `terminal_exec`: Executa comandos
- `terminal_list_dir`: Lista diretórios
- `terminal_read_file`: Lê arquivos
- `terminal_write_file`: Escreve arquivos
- `terminal_rename`: Renomeia arquivos/diretórios
- `terminal_remove`: Remove arquivos/diretórios
- `terminal_mkdir`: Cria diretórios
- `terminal_exists`: Verifica se arquivo/diretório existe
- `terminal_pwd`: Mostra diretório atual
- `terminal_cd`: Muda diretório

### Ferramentas de Configuração
- `get_config`: Mostra configuração atual
- `set_context`: Altera contexto (local/ssh/github)

## Contextos

### Local
Execute comandos no sistema local onde o MCP está rodando.

### SSH
Execute comandos em um servidor remoto via SSH:
```
set_context ssh usuario:senha@host:porta /caminho/inicial
```

### GitHub
Integração com repositórios GitHub (configuração via token em desenvolvimento).

## Dependências

- `@modelcontextprotocol/sdk`: SDK oficial do MCP
- `ssh2`: Cliente SSH para Node.js
- `zod`: Validação de esquemas
- `dotenv`: Gerenciamento de variáveis de ambiente

## Licença

MIT