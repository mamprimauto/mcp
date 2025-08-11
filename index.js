import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupTerminalTools } from './terminal-service.js';
import * as dotenv from 'dotenv';

// Obter o diretório atual
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Configuração global
export const globalConfig = {
  context: 'local',
  
  github: {
    token: process.env.GITHUB_TOKEN || '',
    owner: '',
    repo: ''
  },
  
  ssh: {
    host: '',
    port: '22',
    username: '',
    password: '',
    appPath: ''
  },
  
  localWorkDir: process.cwd()
};

// Inicializar o servidor MCP
const server = new McpServer({
  name: 'Global MCP Manager',
  version: '1.0.0',
  capabilities: {
    tools: {}
  }
});

// Configurar as ferramentas de terminal
setupTerminalTools(server);

// Ferramenta para verificar configuração atual
server.tool(
  'get_config',
  {},
  async () => {
    try {
      const maskedConfig = {
        context: globalConfig.context,
        github: {
          token: globalConfig.github.token ? '***' + globalConfig.github.token.slice(-4) : 'Não configurado',
          owner: globalConfig.github.owner || 'Não configurado',
          repo: globalConfig.github.repo || 'Não configurado'
        },
        ssh: {
          host: globalConfig.ssh.host || 'Não configurado',
          port: globalConfig.ssh.port || 'Não configurado',
          username: globalConfig.ssh.username || 'Não configurado',
          password: globalConfig.ssh.password ? '******' : 'Não configurado',
          appPath: globalConfig.ssh.appPath || 'Não configurado'
        },
        localWorkDir: globalConfig.localWorkDir
      };

      return {
        content: [
          {
            type: 'text',
            text: `Configuração atual do Global MCP Manager:
            
Contexto atual: ${maskedConfig.context}

GitHub:
- Repositório: ${maskedConfig.github.owner}/${maskedConfig.github.repo}
- Token: ${maskedConfig.github.token}

SSH:
- Servidor: ${maskedConfig.ssh.username}@${maskedConfig.ssh.host}:${maskedConfig.ssh.port}
- Caminho da aplicação: ${maskedConfig.ssh.appPath}

Sistema local:
- Diretório de trabalho: ${maskedConfig.localWorkDir}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Erro ao obter configuração: ${error.message}`
          }
        ]
      };
    }
  }
);

// Conectar o servidor ao transporte de E/S padrão
const transport = new StdioServerTransport();
server.connect(transport);
