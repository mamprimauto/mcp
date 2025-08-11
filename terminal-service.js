import { promises as fs } from 'fs';
import { exec } from 'child_process';
import path from 'path';
import { z } from 'zod';
import util from 'util';
import { globalConfig } from './index.js';
import { Client } from 'ssh2';

const execPromise = util.promisify(exec);

// Função auxiliar para SSH
async function execSSH(host, port, username, password, command) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = '';
    let stderr = '';

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        stream.on('close', (code) => {
          conn.end();
          resolve({ stdout, stderr, code });
        }).on('data', (data) => {
          stdout += data.toString();
        }).stderr.on('data', (data) => {
          stderr += data.toString();
        });
      });
    }).on('error', (err) => {
      reject(err);
    }).connect({
      host,
      port: parseInt(port, 10),
      username,
      password,
      readyTimeout: 30000,
      hostVerifier: () => true
    });
  });
}

// Função auxiliar para executar comandos
async function executeCommand(command, cwd = null) {
  if (globalConfig.context === 'ssh') {
    if (!globalConfig.ssh.host || !globalConfig.ssh.username || !globalConfig.ssh.password) {
      throw new Error('Configuração SSH incompleta');
    }
    
    const { stdout, stderr } = await execSSH(
      globalConfig.ssh.host,
      globalConfig.ssh.port,
      globalConfig.ssh.username,
      globalConfig.ssh.password,
      command
    );
    
    return `${stdout}${stderr}`.trim();
  } else {
    const { stdout, stderr } = await execPromise(command, {
      cwd: cwd || globalConfig.localWorkDir,
    });
    
    return `${stdout}${stderr}`.trim();
  }
}

export function setupTerminalTools(server) {
  
  server.tool(
    'terminal_exec',
    {
      command: z.string(),
      cwd: z.string().optional(),
    },
    async ({ command, cwd }) => {
      try {
        const result = await executeCommand(command, cwd);
        return {
          content: [{ type: 'text', text: result }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Erro: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    'terminal_list_dir',
    {
      dir: z.string().default('.'),
    },
    async ({ dir }) => {
      try {
        if (globalConfig.context === 'ssh') {
          const command = `ls -la "${dir || globalConfig.ssh.appPath || '~'}"`;
          const result = await executeCommand(command);
          return {
            content: [{ type: 'text', text: result }],
          };
        } else {
          const targetDir = dir || '.';
          const files = await fs.readdir(targetDir, { withFileTypes: true });
          
          const fileList = files.map(file => ({
            name: file.name,
            isDirectory: file.isDirectory(),
            path: path.join(targetDir, file.name),
          }));

          return {
            content: [{ type: 'text', text: JSON.stringify(fileList, null, 2) }],
          };
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Erro ao listar diretório: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    'terminal_read_file',
    {
      path: z.string(),
    },
    async ({ path }) => {
      try {
        if (globalConfig.context === 'ssh') {
          const command = `cat "${path}"`;
          const result = await executeCommand(command);
          return {
            content: [{ type: 'text', text: result }],
          };
        } else {
          const content = await fs.readFile(path, 'utf8');
          return {
            content: [{ type: 'text', text: content }],
          };
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Erro ao ler arquivo: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    'terminal_write_file',
    {
      path: z.string(),
      content: z.string(),
    },
    async ({ path, content }) => {
      try {
        if (globalConfig.context === 'ssh') {
          const escapedContent = content.replace(/"/g, '\\"').replace(/\$/g, '\\$');
          const command = `cat > "${path}" << 'MCPEOF'\n${content}\nMCPEOF`;
          const result = await executeCommand(command);
          return {
            content: [{ type: 'text', text: `Arquivo criado/atualizado: ${path}` }],
          };
        } else {
          const dirPath = path.split('/').slice(0, -1).join('/');
          if (dirPath) {
            await fs.mkdir(dirPath, { recursive: true }).catch(() => {});
          }
          
          await fs.writeFile(path, content, 'utf8');
          
          return {
            content: [{ type: 'text', text: `Arquivo criado/atualizado: ${path}` }],
          };
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Erro ao escrever arquivo: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    'terminal_rename',
    {
      old_path: z.string(),
      new_path: z.string(),
    },
    async ({ old_path, new_path }) => {
      try {
        if (globalConfig.context === 'ssh') {
          const command = `mv "${old_path}" "${new_path}"`;
          await executeCommand(command);
          return {
            content: [{ type: 'text', text: `Renomeado: ${old_path} -> ${new_path}` }],
          };
        } else {
          await fs.rename(old_path, new_path);
          return {
            content: [{ type: 'text', text: `Renomeado: ${old_path} -> ${new_path}` }],
          };
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Erro ao renomear: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    'terminal_remove',
    {
      path: z.string(),
      recursive: z.boolean().default(false),
    },
    async ({ path, recursive }) => {
      try {
        if (globalConfig.context === 'ssh') {
          const command = recursive ? `rm -rf "${path}"` : `rm "${path}"`;
          await executeCommand(command);
          return {
            content: [{ type: 'text', text: `Removido: ${path}` }],
          };
        } else {
          const stats = await fs.stat(path);
          
          if (stats.isDirectory()) {
            if (recursive) {
              await fs.rm(path, { recursive: true, force: true });
            } else {
              await fs.rmdir(path);
            }
          } else {
            await fs.unlink(path);
          }
          
          return {
            content: [{ type: 'text', text: `Removido: ${path}` }],
          };
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Erro ao remover: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    'terminal_mkdir',
    {
      path: z.string(),
      recursive: z.boolean().default(true),
    },
    async ({ path, recursive }) => {
      try {
        if (globalConfig.context === 'ssh') {
          const command = recursive ? `mkdir -p "${path}"` : `mkdir "${path}"`;
          await executeCommand(command);
          return {
            content: [{ type: 'text', text: `Diretório criado: ${path}` }],
          };
        } else {
          await fs.mkdir(path, { recursive });
          return {
            content: [{ type: 'text', text: `Diretório criado: ${path}` }],
          };
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Erro ao criar diretório: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    'terminal_exists',
    {
      path: z.string(),
    },
    async ({ path }) => {
      try {
        if (globalConfig.context === 'ssh') {
          const command = `[ -e "${path}" ] && echo "EXISTS" || echo "NOT_EXISTS"`;
          const result = await executeCommand(command);
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                exists: result.includes('EXISTS'),
              }, null, 2),
            }],
          };
        } else {
          const stats = await fs.stat(path);
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                exists: true,
                isDirectory: stats.isDirectory(),
                isFile: stats.isFile(),
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
              }, null, 2),
            }],
          };
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              exists: false,
              error: error.message,
            }, null, 2),
          }],
        };
      }
    }
  );

  server.tool(
    'terminal_pwd',
    {},
    async () => {
      try {
        if (globalConfig.context === 'ssh') {
          const result = await executeCommand('pwd');
          return {
            content: [{ type: 'text', text: result }],
          };
        } else {
          const cwd = process.cwd();
          return {
            content: [{ type: 'text', text: cwd }],
          };
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Erro ao obter diretório atual: ${error.message}` }],
        };
      }
    }
  );

  server.tool(
    'terminal_cd',
    {
      dir: z.string(),
    },
    async ({ dir }) => {
      try {
        if (globalConfig.context === 'ssh') {
          globalConfig.ssh.appPath = dir;
          return {
            content: [{ type: 'text', text: `Diretório SSH padrão alterado para: ${dir}` }],
          };
        } else {
          await fs.access(dir);
          process.chdir(dir);
          globalConfig.localWorkDir = process.cwd();
          
          return {
            content: [{ type: 'text', text: `Diretório alterado para: ${globalConfig.localWorkDir}` }],
          };
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Erro ao mudar diretório: ${error.message}` }],
        };
      }
    }
  );
  
  server.tool(
    'set_context',
    {
      type: z.enum(['local', 'ssh', 'github']),
      config: z.string().optional(),
    },
    async ({ type, config }) => {
      try {
        globalConfig.context = type;
        
        if (type === 'ssh' && config) {
          const sshPattern = /^([^:]+):([^@]+)@([^:]+):?(\d*)?\s*(.*)$/;
          const match = config.match(sshPattern);
          
          if (match) {
            globalConfig.ssh.username = match[1];
            globalConfig.ssh.password = match[2];
            globalConfig.ssh.host = match[3];
            globalConfig.ssh.port = match[4] || '22';
            globalConfig.ssh.appPath = match[5] || '';
            
            try {
              const { stdout } = await execSSH(
                globalConfig.ssh.host,
                globalConfig.ssh.port,
                globalConfig.ssh.username,
                globalConfig.ssh.password,
                "echo 'Conexão SSH estabelecida'"
              );
              
              return {
                content: [{
                  type: 'text',
                  text: `Contexto alterado para: ${type} (${config})\nConexão SSH estabelecida!`,
                }],
              };
            } catch (sshError) {
              return {
                content: [{
                  type: 'text',
                  text: `Erro ao estabelecer conexão SSH: ${sshError.message}`,
                }],
              };
            }
          } else {
            return {
              content: [{
                type: 'text',
                text: `Formato inválido. Use: set_context ssh usuario:senha@host:porta /caminho/app`,
              }],
            };
          }
        } else if (type === 'github' && config) {
          const githubPattern = /^([^\/]+)\/([^\/]+)$/;
          const match = config.match(githubPattern);
          
          if (match) {
            globalConfig.github.owner = match[1];
            globalConfig.github.repo = match[2];
          } else {
            return {
              content: [{
                type: 'text',
                text: `Formato inválido. Use: set_context github owner/repo`,
              }],
            };
          }
        }
        
        return {
          content: [{
            type: 'text',
            text: `Contexto alterado para: ${type}${config ? ` (${config})` : ''}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Erro ao mudar contexto: ${error.message}`,
          }],
        };
      }
    }
  );
}
